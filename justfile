project_ref := env_var("SUPABASE_PROJECT_REF")

deploy:
    supabase functions deploy usd-all --project-ref {{project_ref}}

verify:
    curl --fail --silent --show-error https://{{project_ref}}.supabase.co/functions/v1/usd-all | jq
