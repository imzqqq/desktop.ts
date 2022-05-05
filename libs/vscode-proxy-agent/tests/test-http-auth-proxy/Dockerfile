FROM minimum2scp/squid:latest

RUN apt-get update \
    && apt-get install -y apache2-utils \
    && rm -rf /var/lib/apt/lists/*

COPY basic_auth.conf /etc/squid/squid.acl.conf

RUN htpasswd -bc /etc/squid/.htpasswd foo bar
