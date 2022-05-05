FROM nginx:latest

RUN apt-get update \
    && apt-get install -y openssl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /etc/nginx

CMD openssl req -nodes -x509 -newkey rsa:2048 -keyout ssl_key.pem -out ssl_cert.pem -days 365 -subj "/C=US/ST=Oregon/L=Portland/O=IT/CN=test-https-server" \
    && openssl req -nodes -x509 -newkey rsa:2048 -keyout ssl_teapot_key.pem -out ssl_teapot_cert.pem -days 365 -subj "/C=US/ST=Oregon/L=Portland/O=IT/CN=test-teapot-server" \
    && nginx -g 'daemon off;'
