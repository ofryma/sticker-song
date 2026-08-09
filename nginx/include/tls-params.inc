# TLS material and protocol settings, shared by the HTTPS server blocks in
# tls.conf. Included at server level.
#
# One fixed path, always populated: the init-certs step copies the live
# certificate out of certbot's tree into the certs volume, or writes a
# self-signed placeholder if there is none yet, and the certbot service copies
# again on every renewal. nginx therefore never has to know certbot's layout,
# and never fails to start because a file is missing.
ssl_certificate     /etc/nginx/certs/fullchain.pem;
ssl_certificate_key /etc/nginx/certs/privkey.pem;

# TLS 1.2 is kept for older Android, which is a real share of the phones this
# archive is photographed on.
ssl_protocols TLSv1.2 TLSv1.3;
ssl_prefer_server_ciphers off;

ssl_session_cache shared:SSL:10m;
ssl_session_timeout 1d;
ssl_session_tickets off;
