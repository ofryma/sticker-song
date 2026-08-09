# Everything a server block needs to serve the archive: the SPA at /, the
# FastAPI app under /api/ (the prefix is stripped before it reaches uvicorn,
# which matches how Vite proxies /api in development).
#
# Included at server level by every server that serves the app — the plain-HTTP
# one in default.conf and the TLS one in tls.conf. It lives in a separate file
# so those two can never drift apart: an nginx server block inherits nothing
# from a sibling, and keeping two copies of these locations in step by hand is
# the way this file rots.
#
# Not a template and not in conf.d: it holds no ${DOMAIN}, and nginx loads
# conf.d/*.conf on its own but reaches this only through an explicit include.

# Uploads are capped at 10 MB by the API; leave headroom for the multipart
# envelope so the API returns its own error rather than an nginx 413.
client_max_body_size 12m;

gzip on;
gzip_vary on;
gzip_min_length 1024;
gzip_types text/plain text/css application/javascript application/json image/svg+xml;

add_header X-Content-Type-Options nosniff always;
add_header X-Frame-Options SAMEORIGIN always;
add_header Referrer-Policy same-origin always;

# Liveness for the host or an uptime check, answered without touching the app.
location = /healthz {
    access_log off;
    return 200 "ok\n";
}

# The two public writes, rate limited (the zone is defined in default.conf).
# Exact matches, so nothing deeper — /api/entries/<id>/image and the rest — is
# caught by them. The proxy settings are repeated verbatim from /api/ below
# because an nginx location inherits nothing from a sibling; keep the three in
# step.
location = /api/entries {
    limit_req zone=public_write burst=3 nodelay;

    set $backend http://backend:8000;
    rewrite ^/api/(.*)$ /$1 break;
    proxy_pass $backend;

    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;

    proxy_buffering off;
    proxy_read_timeout 120s;
    proxy_request_buffering off;
}

location = /api/messages {
    limit_req zone=public_write burst=3 nodelay;

    set $backend http://backend:8000;
    rewrite ^/api/(.*)$ /$1 break;
    proxy_pass $backend;

    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;

    proxy_buffering off;
    proxy_read_timeout 120s;
    proxy_request_buffering off;
}

location /api/ {
    set $backend http://backend:8000;
    rewrite ^/api/(.*)$ /$1 break;
    proxy_pass $backend;

    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;

    # Image responses stream out of MinIO through the API; don't buffer them.
    proxy_buffering off;
    proxy_read_timeout 120s;
    proxy_request_buffering off;
}

location / {
    set $frontend http://frontend:80;
    proxy_pass $frontend;

    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}
