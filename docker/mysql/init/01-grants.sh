#!/bin/sh
# Hanya untuk pengembangan lokal: pengguna aplikasi boleh membuat basis data
# bayangan (prisma migrate dev) dan basis data uji.
set -e
mysql -uroot -p"$MYSQL_ROOT_PASSWORD" -e "GRANT ALL PRIVILEGES ON *.* TO '$MYSQL_USER'@'%'; FLUSH PRIVILEGES;"
