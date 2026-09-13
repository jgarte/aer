deploy project_ref:
    supabase functions deploy usd-all --project-ref {{project_ref}}

verify project_ref:
    curl --fail --silent --show-error https://{{project_ref}}.supabase.co/functions/v1/usd-all | jq
