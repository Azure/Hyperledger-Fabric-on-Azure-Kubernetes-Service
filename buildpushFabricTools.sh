DOCKERNAME=$1
TAG=$2
REPO=fabricTools
IMAGE_NAME=fabric-tools
PACKAGE=$PWD
SOURCE=$IMAGE_NAME:1.0
TARGET=$DOCKERNAME/$IMAGE_NAME:$TAG

docker build -f fabricTools/$REPO.dockerfile -t $SOURCE $PACKAGE
docker tag $SOURCE $TARGET
docker push $TARGET
