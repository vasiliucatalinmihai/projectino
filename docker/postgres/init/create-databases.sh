#!/bin/bash
set -e

# Runs once, the first time the postgres data volume is initialised.
# Add more CREATE DATABASE lines here if the project grows to need them.
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" <<-EOSQL
    CREATE DATABASE productino;
    GRANT ALL PRIVILEGES ON DATABASE productino TO $POSTGRES_USER;
EOSQL
