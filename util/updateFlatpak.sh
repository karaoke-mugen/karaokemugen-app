DIST_NAME=dist_linux-7.x.tar.gz

wget -N https://mugen.karaokes.moe/downloads/$DIST_NAME
DIST_SHA=$(sha256sum $DIST_NAME | awk -F\  {'print $1'})

SENTRYCLI_VERSION=$(cat package.json | grep @sentry/cli\": | awk -F\" {'print $4'} | sed -e 's/\^//g')

wget -N https://downloads.sentry-cdn.com/sentry-cli/$SENTRYCLI_VERSION/sentry-cli-Linux-x86_64

SENTRYCLI_SHA=$(sha256sum sentry-cli-Linux-x86_64 | awk -F\  {'print $1'})

node util/updateFlatpak.cjs $DIST_NAME $DIST_SHA $SENTRYCLI_VERSION $SENTRYCLI_SHA