artifactsFolder=out
rootFolder="$(dirname `pwd`)"


dockerfileLocation="fabricTools/fabricTools.dockerfile"
pushd $rootFolder
docker build . -f ${dockerfileLocation} -t $1 \
    --build-arg GO_VERSION=1.13.12 \
    --build-arg ALPINE_VERSION=3.12 \
    --build-arg FABRIC_VERSION=1.4.8 \
    --build-arg FABRIC_CA_VERSION=1.4.8
popd

artifactsFolder=${rootFolder}/${artifactsFolder}

if [[ -d $artifactsFolder ]]
then
    rm -rf $artifactsFolder
fi

mkdir $artifactsFolder
mkdir "${artifactsFolder}/nestedtemplates"
mkdir "${artifactsFolder}/artifacts"

publicIpTemplatePath="nestedtemplates/publicIpTemplate.json"

funcNodeJSFolder="$rootFolder/funcNodeJS"
funcNodeJSPath="$funcNodeJSFolder"
createUiDef="$rootFolder/createUiDefinition.json"
mainTemplate="$rootFolder/mainTemplate.json"
publicIpTemplate="$rootFolder/$publicIpTemplatePath"

nodeJsArchivePath="${artifactsFolder}/artifacts/funcNodeJS.zip"

pushd $funcNodeJSFolder
podJsonLocation=aksManifests/fabricTools/pod.json
cp $podJsonLocation "${podJsonLocation}_backup"
sed -i 's|hlfakstemplate.azurecr.io\/fabric-tools:versionplaceholder|'"$1"'|g' $podJsonLocation
npm ci
zip -r $nodeJsArchivePath *
mv "${podJsonLocation}_backup" $podJsonLocation
popd

cp $publicIpTemplate "$artifactsFolder/$publicIpTemplatePath"
cp $createUiDef $artifactsFolder
cp $mainTemplate $artifactsFolder

pushd $artifactsFolder
zip -r "${artifactsFolder}/hlf-marketplace.zip" *
popd