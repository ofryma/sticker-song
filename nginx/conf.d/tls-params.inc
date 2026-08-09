# TLS material and protocol settings, shared by the HTTPS server blocks in
# tls.conf. Included at server level; not loaded on its own (nginx reads
# conf.d/*.conf, and this is an .inc).
#
# The paths are plain files, not certbot's `live/` symlinks: the certificate is
# copied into ./nginx/certs — which the compose file mounts read-only — by
# `make prod-cert-install`, and `make prod-cert-renew` copies again and reloads.
# nginx therefore needs to know nothing about certbot's layout.
ssl_certificate     /etc/nginx/certs/fullchain.pem;
ssl_certificate_key /etc/nginx/certs/privkey.pem;

# TLS 1.2 is kept for older Android, which is a real share of the phones this
# archive is photographed on.
ssl_protocols TLSv1.2 TLSv1.3;
ssl_prefer_server_ciphers off;

ssl_session_cache shared:SSL:10m;
ssl_session_timeout 1d;
ssl_session_tickets off;
