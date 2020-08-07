FROM hyperledger/fabric-ca:1.4.4

FROM hyperledger/fabric-tools:1.4.4

ARG GIT_COMMIT=unspecified
LABEL git_commit=$GIT_COMMIT

COPY --from=0 /usr/local/bin/fabric-ca-client /usr/local/bin
RUN curl -LO https://storage.googleapis.com/kubernetes-release/release/v1.15.5/bin/linux/amd64/kubectl
RUN chmod +x ./kubectl
RUN mv ./kubectl /usr/local/bin/kubectl
RUN mkdir /var/hyperledger/deployments
RUN mkdir /var/hyperledger/scripts
RUN mkdir /var/hyperledger/consortiumScripts
RUN mkdir /var/hyperledger/src
RUN mkdir /var/hyperledger/src/chaincode

# Download azcopy
RUN wget https://aka.ms/downloadazcopy-v10-linux
RUN tar -xvf downloadazcopy-v10-linux
RUN cp ./azcopy_linux_amd64_*/azcopy /usr/bin/

# Download jq tool
RUN apt-get -y update && apt-get -y install jq

COPY ./fabricTools/deployments /var/hyperledger/deployments
COPY ./fabricTools/scripts /var/hyperledger/scripts

COPY ./consortiumScripts/scripts /var/hyperledger/consortiumScripts
COPY ./consortiumScripts/chaincode /var/hyperledger/src/chaincode

RUN chmod +x /var/hyperledger/scripts/*.sh
RUN chmod +x /var/hyperledger/consortiumScripts/*.sh
