#!/bin/bash

if ! [ -x "$(command -v docker)" ]; then
  echo 'Error: docker is not installed.' >&2
  exit 1
fi

domains=(myphotosadmin.earth-summit.com myphotos.earth-summit.com)
rsa_key_size=4096
data_path="./nginx/certs"
email="" # Adding a valid address is strongly recommended
staging=0 # Set to 1 if you're testing your setup to avoid hitting request limits

if [ -d "$data_path" ]; then
  echo "Existing data found for $domains. Replacing existing certificate..."
fi


if [ ! -e "$data_path/options-ssl-nginx.conf" ] || [ ! -e "$data_path/ssl-dhparams.pem" ]; then
  echo "### Downloading recommended TLS parameters ..."
  mkdir -p "$data_path"
  curl -s https://raw.githubusercontent.com/certbot/certbot/master/certbot-nginx/certbot_nginx/_internal/tls_configs/options-ssl-nginx.conf > "$data_path/options-ssl-nginx.conf"
  curl -s https://raw.githubusercontent.com/certbot/certbot/master/certbot/certbot/ssl-dhparams.pem > "$data_path/ssl-dhparams.pem"
  echo
fi

echo "### Creating dummy certificate for $domains ..."
path="/etc/letsencrypt/live/$domains"
sudo docker compose -f docker-compose.prod.yml run --rm --entrypoint "\
  sh -c 'mkdir -p $path && openssl req -x509 -nodes -newkey rsa:$rsa_key_size -days 1\
    -keyout \"$path/privkey.pem\" \
    -out \"$path/fullchain.pem\" \
    -subj \"/CN=localhost\"'" certbot
echo


echo "### Starting nginx ..."
sudo docker compose -f docker-compose.prod.yml up --force-recreate -d nginx
echo

echo "### Deleting dummy certificate for $domains ..."
sudo docker compose -f docker-compose.prod.yml run --rm --entrypoint "\
  rm -Rf /etc/letsencrypt/live/$domains && \
  rm -Rf /etc/letsencrypt/archive/$domains && \
  rm -Rf /etc/letsencrypt/renewal/$domains.conf" certbot
echo


echo "### Requesting Let's Encrypt certificate for $domains ..."
#Join $domains to -d args
domain_args=""
for domain in "${domains[@]}"; do
  domain_args="$domain_args -d $domain"
done

# Select appropriate email arg
case "$email" in
  "") email_arg="--register-unsafely-without-email" ;;
  *) email_arg="--email $email" ;;
esac

# Enable staging mode if needed
if [ $staging != "0" ]; then staging_arg="--staging"; fi

sudo docker compose -f docker-compose.prod.yml run --rm --entrypoint "\
  certbot certonly --webroot -w /var/www/certbot \
    $staging_arg \
    $email_arg \
    $domain_args \
    --rsa-key-size $rsa_key_size \
    --agree-tos \
    --force-renewal" certbot
echo

echo "### Reloading nginx ..."
sudo docker compose -f docker-compose.prod.yml exec nginx nginx -s reload
