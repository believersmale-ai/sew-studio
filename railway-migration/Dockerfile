FROM postgres:17
RUN apt-get update && apt-get install -y --no-install-recommends bash coreutils ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /opt/migration
COPY scripts/ /opt/migration/scripts/
RUN chmod +x /opt/migration/scripts/*.sh
ENTRYPOINT ["/opt/migration/scripts/entrypoint.sh"]
