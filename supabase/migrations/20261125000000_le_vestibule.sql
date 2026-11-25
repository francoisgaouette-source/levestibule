-- Le Vestibule (HoldingAI) : schéma complet du projet Supabase « Le Vestibule ».
-- Connexion : compte HoldingAI obligatoire (Third-Party Auth > Custom OIDC), comme toutes les apps HoldingAI.
-- Un membre est reconnu par le cellulaire de son compte HoldingAI.
-- Forfait comme Le Commis : essai gratuit de 30 jours, puis 19,99 $ par année pour tout le foyer (Stripe).
-- Après l'essai, sans paiement, le foyer garde ses données en lecture seule.

create extension if not exists pgcrypto;
create schema if not exists private;

-- =========================================================
-- 1. Foyers et membres
-- =========================================================
create table if not exists public.foyers (
  id                 uuid primary key default gen_random_uuid(),
  nom                text not null default 'Notre famille',
  proprio            uuid,
  -- adresse de transfert des courriels de l'école : famille-<code>@levestibule.ai
  code_courriel      text not null unique default lower(substr(encode(gen_random_bytes(6), 'hex'), 1, 8)),
  -- abonnement au calendrier de l'école (lien secret .ics)
  jeton_calendrier   text not null unique default encode(gen_random_bytes(16), 'hex'),
  fuseau             text not null default 'America/Toronto',
  expediteurs        text not null default '',
  confirmation_gmail text,           -- lien de confirmation envoyé par Gmail à l'adresse de transfert
  dernier_courriel   timestamptz,
  essai_fin          timestamptz not null default now() + interval '30 days',
  paye_jusqua        timestamptz,
  cree               timestamptz not null default now()
);

create table if not exists public.membres (
  id          uuid primary key default gen_random_uuid(),
  foyer_id    uuid not null references public.foyers(id) on delete cascade,
  user_id     uuid,                  -- identifiant HoldingAI, rempli à la première connexion
  prenom      text not null default '',
  telephone   text,                  -- +15145551234
  role        text not null default 'membre' check (role in ('proprio', 'membre')),
  fin_travail time not null default '17:30',
  rappel_soir boolean not null default true,
  rappel_matin boolean not null default true,
  cree        timestamptz not null default now()
);
create index if not exists membres_foyer_idx on public.membres(foyer_id);
create unique index if not exists membres_tel_unique on public.membres(telephone) where telephone is not null;
create unique index if not exists membres_user_unique on public.membres(user_id) where user_id is not null;

-- Réglages privés d'une personne (jamais visibles du coparent)
create table if not exists public.prives (
  user_id  uuid primary key default auth.uid(),
  ical_url text check (ical_url is null or ical_url ~ '^https://'),
  maj      timestamptz not null default now()
);

create or replace function private.chiffres(t text) returns text language sql immutable as $$
  select nullif(regexp_replace(coalesce(t, ''), '\D', '', 'g'), '');
$$;

create or replace function private.mon_foyer()
returns uuid language sql stable security definer set search_path = public, private as $$
  select m.foyer_id from public.membres m
  where m.user_id = auth.uid()
     or (m.user_id is null and m.telephone is not null and private.chiffres(m.telephone) = private.chiffres(auth.jwt() ->> 'phone'))
  order by (m.user_id = auth.uid()) desc nulls last
  limit 1;
$$;
create or replace function private.mon_membre()
returns uuid language sql stable security definer set search_path = public, private as $$
  select m.id from public.membres m where m.user_id = auth.uid() limit 1;
$$;
-- Le foyer est actif pendant l'essai ou tant qu'il est payé; sinon, lecture seule
create or replace function private.foyer_actif()
returns boolean language sql stable security definer set search_path = public, private as $$
  select exists (select 1 from public.foyers f where f.id = private.mon_foyer()
                 and (f.essai_fin > now() or coalesce(f.paye_jusqua, '-infinity') > now()));
$$;
grant usage on schema private to authenticated;
grant execute on function private.mon_foyer(), private.mon_membre(), private.chiffres(text), private.foyer_actif() to authenticated;

-- Cellulaire normalisé, 4 membres au plus, au moins un
-- (security invoker : current_user est le rôle de l'app, ce qui distingue l'app des fonctions serveur)
create or replace function private.verifier_membre()
returns trigger language plpgsql set search_path = public, private as $$
declare d text;
begin
  if tg_op in ('INSERT', 'UPDATE') then
    new.prenom := left(trim(coalesce(new.prenom, '')), 40);
    d := private.chiffres(new.telephone);
    if d is null then new.telephone := null;
    elsif length(d) = 10 then new.telephone := '+1' || d;
    elsif length(d) = 11 and left(d, 1) = '1' then new.telephone := '+' || d;
    elsif length(d) between 8 and 15 then new.telephone := '+' || d;
    else raise exception 'cellulaire_invalide' using errcode = 'P0001';
    end if;
    if tg_op = 'INSERT' and (select count(*) from public.membres where foyer_id = new.foyer_id) >= 4 then
      raise exception 'limite_membres' using errcode = 'P0001';
    end if;
    -- l'app ne choisit jamais le compte lié à une fiche : seul lier_compte() le fait
    if tg_op = 'INSERT' and current_user = 'authenticated' then new.user_id := null; end if;
    if tg_op = 'UPDATE' and new.user_id is distinct from old.user_id and current_user = 'authenticated' then
      new.user_id := old.user_id;
    end if;
    return new;
  else
    if current_user = 'authenticated' and (select count(*) from public.membres where foyer_id = old.foyer_id) <= 1 then raise exception 'dernier_membre' using errcode = 'P0001'; end if;
    return old;
  end if;
end $$;
drop trigger if exists membres_verif on public.membres;
create trigger membres_verif before insert or update or delete on public.membres
  for each row execute function private.verifier_membre();

-- Créer son foyer (première connexion)
create or replace function public.creer_foyer(p_prenom text, p_enfants text[] default '{}', p_fuseau text default 'America/Toronto')
returns uuid language plpgsql security definer set search_path = public, private as $$
declare f uuid; e text; i int := 0;
begin
  if auth.uid() is null then raise exception 'connexion_requise' using errcode = 'P0001'; end if;
  if private.mon_foyer() is not null then raise exception 'deja_membre' using errcode = 'P0001'; end if;
  insert into public.foyers (proprio, fuseau) values (auth.uid(), coalesce(nullif(p_fuseau, ''), 'America/Toronto')) returning id into f;
  insert into public.membres (foyer_id, user_id, prenom, telephone, role)
    values (f, auth.uid(), coalesce(p_prenom, ''), nullif(auth.jwt() ->> 'phone', ''), 'proprio');
  foreach e in array coalesce(p_enfants, '{}') loop
    if trim(e) <> '' then i := i + 1; insert into public.enfants (foyer_id, prenom, ordre) values (f, left(trim(e), 40), i); end if;
  end loop;
  return f;
end $$;
revoke all on function public.creer_foyer(text, text[], text) from public, anon;
grant execute on function public.creer_foyer(text, text[], text) to authenticated;

-- Le coparent invité par son cellulaire : à sa première connexion, sa fiche est liée à son compte
create or replace function public.lier_compte()
returns uuid language plpgsql security definer set search_path = public, private as $$
declare m uuid;
begin
  if auth.uid() is null then return null; end if;
  select id into m from public.membres where user_id = auth.uid();
  if m is not null then return m; end if;
  update public.membres set user_id = auth.uid()
   where id = (select id from public.membres where user_id is null and telephone is not null
               and private.chiffres(telephone) = private.chiffres(auth.jwt() ->> 'phone') limit 1)
  returning id into m;
  return m;
end $$;
revoke all on function public.lier_compte() from public, anon;
grant execute on function public.lier_compte() to authenticated;

-- Activation après paiement (appelée par la fonction stripe-webhook, avec la clé serveur seulement)
create or replace function public.activer_foyer(p_foyer uuid, p_annees int default 1)
returns timestamptz language sql security definer set search_path = public as $$
  update public.foyers
     set paye_jusqua = greatest(now(), coalesce(paye_jusqua, now()), essai_fin) + make_interval(years => greatest(1, p_annees))
   where id = p_foyer
  returning paye_jusqua;
$$;
revoke all on function public.activer_foyer(uuid, int) from public, anon, authenticated;

-- =========================================================
-- 2. Ce que le vestibule garde
-- =========================================================
create table if not exists public.enfants (
  id       uuid primary key default gen_random_uuid(),
  foyer_id uuid not null default private.mon_foyer() references public.foyers(id) on delete cascade,
  prenom   text not null,
  ordre    int not null default 0
);

-- Éléments de l'école : activités, objets à apporter, formulaires, paiements, congés
create table if not exists public.elements (
  id          uuid primary key default gen_random_uuid(),
  foyer_id    uuid not null default private.mon_foyer() references public.foyers(id) on delete cascade,
  genre       text not null default 'activite' check (genre in ('activite', 'apporter', 'formulaire', 'payer', 'conge')),
  titre       text not null check (length(titre) between 1 and 160),
  jour        date not null,
  heure       time,
  enfant      text not null default '',
  question    text not null default '',   -- à poser à l'enfant le soir même
  source      text not null default '',   -- « Courriel : Sortie au musée », « Photo », « Message collé »
  responsable uuid references public.membres(id) on delete set null,
  fait        boolean not null default false,
  planifie    boolean not null default false, -- congé : quelque chose est prévu pour les enfants
  cree        timestamptz not null default now()
);
create index if not exists elements_foyer_jour_idx on public.elements(foyer_id, jour);
create unique index if not exists elements_sans_double on public.elements(foyer_id, lower(titre), jour);

create table if not exists public.achats (
  id       uuid primary key default gen_random_uuid(),
  foyer_id uuid not null default private.mon_foyer() references public.foyers(id) on delete cascade,
  texte    text not null check (length(texte) between 1 and 160),
  pour     date,
  fait     boolean not null default false,
  cree     timestamptz not null default now()
);

create table if not exists public.gens (
  id       uuid primary key default gen_random_uuid(),
  foyer_id uuid not null default private.mon_foyer() references public.foyers(id) on delete cascade,
  nom      text not null check (length(nom) between 1 and 60),
  note     text not null default '',
  dernier  date,
  cree     timestamptz not null default now()
);

-- Ce qu'on dépose du travail : à soi seulement
create table if not exists public.depots (
  id       uuid primary key default gen_random_uuid(),
  user_id  uuid not null default auth.uid(),
  texte    text not null check (length(texte) between 1 and 2000),
  jour     date not null default current_date,
  fait     boolean not null default false,
  cree     timestamptz not null default now()
);
create index if not exists depots_user_idx on public.depots(user_id, fait);

-- Moments du soir faits ou reportés : à soi seulement
create table if not exists public.moments (
  id      uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  cle     text not null,
  jour    date not null,
  fait    boolean not null default false,
  unique (user_id, cle, jour)
);

-- Notifications (Web Push)
create table if not exists public.abonnements (
  id       uuid primary key default gen_random_uuid(),
  user_id  uuid not null default auth.uid(),
  endpoint text not null unique,
  p256dh   text not null,
  auth     text not null,
  cree     timestamptz not null default now()
);
create table if not exists public.envois (
  user_id uuid not null,
  jour    date not null,
  genre   text not null,
  primary key (user_id, jour, genre)
);
-- Clés de notification et secret du cron : lisibles seulement côté serveur (aucune règle d'accès)
create table if not exists public.push_cles (nom text primary key, valeur text not null);
insert into public.push_cles (nom, valeur) values ('cron', encode(gen_random_bytes(24), 'hex')) on conflict (nom) do nothing;

-- Paiements Stripe (lus par la console HoldingAI)
create table if not exists public.console_paiements (
  id         bigserial primary key,
  app        text not null default 'vestibule',
  session_id text unique,
  reference  text,
  montant    int,
  devise     text,
  courriel   text,
  nom        text,
  active     boolean not null default false,
  cree       timestamptz not null default now()
);

-- Coût des appels à Claude (lu par la console HoldingAI)
create table if not exists public.couts_ia (
  id        bigserial primary key,
  app       text not null default 'vestibule',
  fonction  text not null,
  foyer_id  uuid,
  modele    text,
  entree    int, sortie int, cache_ecrit int, cache_lu int, recherches int,
  cout_usd  numeric,
  cree      timestamptz not null default now()
);

-- =========================================================
-- 3. Sécurité : chacun ne voit que son foyer et ses propres dépôts; écriture pendant l'essai ou si le foyer est payé
-- =========================================================
alter table public.foyers enable row level security;
alter table public.membres enable row level security;
alter table public.prives enable row level security;
alter table public.depots enable row level security;
alter table public.moments enable row level security;
alter table public.abonnements enable row level security;
alter table public.envois enable row level security;
alter table public.push_cles enable row level security;
alter table public.couts_ia enable row level security;
alter table public.console_paiements enable row level security;

drop policy if exists foyer_lecture on public.foyers;
create policy foyer_lecture on public.foyers for select to authenticated using (id = private.mon_foyer());
drop policy if exists foyer_maj on public.foyers;
create policy foyer_maj on public.foyers for update to authenticated using (id = private.mon_foyer() and private.foyer_actif()) with check (id = private.mon_foyer());
-- les codes secrets ne changent pas depuis l'app
revoke update on public.foyers from authenticated;
grant update (nom, fuseau, expediteurs, confirmation_gmail) on public.foyers to authenticated;

-- Lecture : tout le foyer. Écriture : pendant l'essai ou si le foyer est payé.
drop policy if exists membres_foyer on public.membres;
drop policy if exists membres_lecture on public.membres;
create policy membres_lecture on public.membres for select to authenticated using (foyer_id = private.mon_foyer());
drop policy if exists membres_ecriture on public.membres;
create policy membres_ecriture on public.membres for all to authenticated
  using (foyer_id = private.mon_foyer() and private.foyer_actif()) with check (foyer_id = private.mon_foyer() and private.foyer_actif());

do $$
declare t text;
begin
  foreach t in array array['enfants', 'elements', 'achats', 'gens'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists foyer_lecture on public.%I', t);
    execute format('create policy foyer_lecture on public.%I for select to authenticated using (foyer_id = private.mon_foyer())', t);
    execute format('drop policy if exists foyer_ecriture on public.%I', t);
    execute format('create policy foyer_ecriture on public.%I for all to authenticated using (foyer_id = private.mon_foyer() and private.foyer_actif()) with check (foyer_id = private.mon_foyer() and private.foyer_actif())', t);
  end loop;
  foreach t in array array['depots', 'moments'] loop
    execute format('drop policy if exists a_soi_lecture on public.%I', t);
    execute format('create policy a_soi_lecture on public.%I for select to authenticated using (user_id = auth.uid())', t);
    execute format('drop policy if exists a_soi on public.%I', t);
    execute format('create policy a_soi on public.%I for all to authenticated using (user_id = auth.uid() and private.foyer_actif()) with check (user_id = auth.uid() and private.foyer_actif())', t);
  end loop;
  foreach t in array array['prives', 'abonnements'] loop
    execute format('drop policy if exists a_soi on public.%I', t);
    execute format('create policy a_soi on public.%I for all to authenticated using (user_id = auth.uid() and private.mon_foyer() is not null) with check (user_id = auth.uid() and private.mon_foyer() is not null)', t);
  end loop;
end $$;

-- =========================================================
-- 4. Temps réel : ce que l'un ajoute, l'autre le voit aussitôt
-- =========================================================
do $$
declare t text;
begin
  foreach t in array array['elements', 'achats', 'gens', 'membres', 'foyers'] loop
    begin execute format('alter publication supabase_realtime add table public.%I', t); exception when duplicate_object then null; end;
  end loop;
end $$;

-- =========================================================
-- 5. Rappels : toutes les 15 minutes, la fonction regarde qui finit sa journée
-- =========================================================
create extension if not exists pg_cron;
create extension if not exists pg_net;
-- Projet Supabase « Le Vestibule » : jjvwwstovcrqodridfuu
select cron.schedule('rappel-vestibule', '*/15 * * * *', $$
  select net.http_post(
    url := 'https://jjvwwstovcrqodridfuu.supabase.co/functions/v1/rappel',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron', (select valeur from public.push_cles where nom = 'cron')),
    body := '{"action":"envoyer"}'::jsonb);
$$);
