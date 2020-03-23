module.exports = {
  addNodesNameToOrganizationsGateway: async function(
    gatewayObject,
    nodesNameArray,
    orgMSPID,
    nodesType
  ) {
    try {
      nodesNameArray.forEach(nodeName => {
        gatewayObject.organizations[orgMSPID][nodesType].push(nodeName);
      });
      // Delete template object
      gatewayObject.organizations[orgMSPID][nodesType].shift();
      return gatewayObject;
    } catch (err) {
      return err;
    }
  },
  addNodesObjectsToGateway: async function(
    gatewayObject,
    nodesType,
    nodesNameArray,
    nodesDnsArray,
    hlfTlsCaCert
  ) {
    try {
      for (i = 0; i <= nodesNameArray.length - 1; i++) {
        // Get new object without "links" to parent
        let nodeObject = JSON.parse(
          JSON.stringify(gatewayObject[nodesType]["{nodeName0}"])
        );

        // hostnameOverride/ssl-target-name-override should contain only full qualified domain name of the node
        const pureNodeDNS = nodesDnsArray[i]
          .replace("grpcs://", "")
          .replace(":443", "");
        nodeObject.grpcOptions.hostnameOverride = pureNodeDNS;
        nodeObject.grpcOptions["ssl-target-name-override"] = pureNodeDNS;

        nodeObject.url = nodesDnsArray[i];
        nodeObject.tlsCACerts.pem = hlfTlsCaCert;
        gatewayObject[nodesType][nodesNameArray[i]] = nodeObject;
      }
      // Delete template object
      delete gatewayObject[nodesType]["{nodeName0}"];
      return gatewayObject;
    } catch (err) {
      return err;
    }
  },
  addNodesObjectsToNodes: async function(
    nodeObject,
    nodesMspId,
    nodesNameArray,
    tlsCaCertForNodes,
    nodesDnsArray,
    hlfMemberType
  ) {
    const base64TlsCaCert = Buffer.from(tlsCaCertForNodes).toString("base64");
    try {
      const nodesArray = [];
      for (i = 0; i <= nodesNameArray.length - 1; i++) {
        // Get new object without "links" to parent
        let newNodeObject = JSON.parse(JSON.stringify(nodeObject));

        newNodeObject.api_url = nodesDnsArray[i];
        newNodeObject.msp_id = nodesMspId;
        newNodeObject.name = nodesNameArray[i];
        newNodeObject.pem = base64TlsCaCert;
        // delete .orgName for short node name
        newNodeObject.short_name = nodesNameArray[i].replace(/\.\w+/, "");
        newNodeObject.type = `fabric-${hlfMemberType}`;
        newNodeObject = JSON.stringify(newNodeObject, null, 2);
        nodesArray.push(newNodeObject);
      }
      return nodesArray;
    } catch (err) {
      return err;
    }
  },
  getDnsRecords: async function(client) {
    try {
      let nodesResult = await client.apis.extensions.v1beta1
        .namespaces(namespaceNames.NODES)
        .ingresses()
        .get({});

      nodesResult = nodesResult.body.items[0].spec.rules;
      const dnsArray = [];
      nodesResult.forEach(dnsItem => {
        dnsArray.push(`grpcs://${dnsItem.host}:443`);
      });

      let caResult = await client.apis.extensions.v1beta1
        .namespaces(namespaceNames.CA)
        .ingresses()
        .get({});

      caResult = caResult.body.items[0].spec.rules;
      caResult.forEach(dnsItem => {
        dnsArray.push(`grpcs://${dnsItem.host}:443`);
      });
      return dnsArray;
    } catch (err) {
      return err;
    }
  },
  getHlfTlsCaCert: async function(client) {
    try {
      let result = await client.api.v1
        .namespaces(namespaceNames.CA)
        .secrets("hlf-tlsca-idcert")
        .get({});

      let base64cert = result.body.data["ca.crt"];
      const resultCert = new Buffer.from(base64cert, "base64").toString("utf8");
      return resultCert;
    } catch (err) {
      return err;
    }
  },
  getServerCaName: async function(client) {
    // TODO: find ca name in cluster, instead hardcode
    // try {
    //   let result = await client.api.v1.namespaces('default').pods.get({})

    //   result = result.body.items.filter(pod => pod.metadata.name.startsWith('ca-'))
    //   const envVars = result[0].spec.containers[0].env
    //   let serverCaName
    //   envVars.forEach(env => {
    //     if (env.name == 'FABRIC_CA_SERVER_CA_NAME') serverCaName = env.value
    //   })
    //   return serverCaName
    // } catch (err) {
    //   return err
    // }
    return "ca";
  },
  getNodesName: async function(
    client,
    hlfMemberType,
    hlfBackendDbType,
    hlfOrgName
  ) {
    try {
      let result = await client.api.v1
        .namespaces(namespaceNames.NODES)
        .pods.get({});

      let pods = result.body.items.filter(pod =>
        pod.metadata.name.startsWith(hlfMemberType)
      );

      let envVariables;
      let nodesNameArray = [];
      let nodeName;
      for (let i = 0; i <= pods.length - 1; i++) {
        // with peer nodes and couchDB we have 2 containers in pod - first for couchDB, in other way only 1
        if (hlfMemberType == "peer" && hlfBackendDbType == "couchDB") {
          envVariables = pods[i].spec.containers[1].env;
          envVariables.forEach(env => {
            if (env.name == "CORE_PEER_ADDRESS") {
              nodeName = env.value.replace(/(:\d*)/, "");
              nodesNameArray.push(`${nodeName}.${hlfOrgName}`);
            }
          });
        } else if (hlfMemberType == "peer" && hlfBackendDbType == "levelDB") {
          envVariables = pods[i].spec.containers[0].env;
          envVariables.forEach(env => {
            if (env.name == "CORE_PEER_ADDRESS") {
              nodeName = env.value.replace(/(:\d*)/, "");
              nodesNameArray.push(`${nodeName}.${hlfOrgName}`);
            }
          });
        } else {
          envVariables = pods[i].spec.containers[0].env;
          envVariables.forEach(env => {
            if (env.name == "CONFIGTX_ORDERER_ADDRESSES") {
              nodeName = env.value.replace(/(:\d*)/, "");
              nodesNameArray.push(`${nodeName}.${hlfOrgName}`);
            }
          });
        }
      }
      return nodesNameArray;
    } catch (err) {
      return err;
    }
  },
  getAdminPemKey: async function(client) {
    try {
      let result = await client.api.v1
        .namespaces(namespaceNames.ADMIN)
        .secret("hlf-admin-idkey")
        .get({});

      const adminBase64PemKey = result.body.data["key.pem"];
      return adminBase64PemKey;
    } catch (err) {
      return err;
    }
  },
  getAdminPemCert: async function(client) {
    try {
      let result = await client.api.v1
        .namespaces(namespaceNames.ADMIN)
        .secret("hlf-admin-idcert")
        .get({});

      const adminBase64PemCert = result.body.data["cert.pem"];
      return adminBase64PemCert;
    } catch (err) {
      return err;
    }
  },
  getAdminPemTlsKey: async function(client) {
    try {
      let result = await client.api.v1
        .namespaces(namespaceNames.ADMIN)
        .secret("hlf-admin-tls-idkey")
        .get({});

      const adminBase64PemTlsKey = result.body.data["key.pem"];
      return adminBase64PemTlsKey;
    } catch (err) {
      return err;
    }
  },
  getAdminPemTlsCert: async function(client) {
    try {
      let result = await client.api.v1
        .namespaces(namespaceNames.ADMIN)
        .secret("hlf-admin-tls-idcert")
        .get({});

      const adminBase64PemTlsCert = result.body.data["cert.pem"];
      return adminBase64PemTlsCert;
    } catch (err) {
      return err;
    }
  },
  getAdminUserName: async function(client) {
    // TODO: find admin name in cluster, instead hardcode

    // try {
    //   let result = await client.api.v1.namespaces('default').secret('ca-credentials').get({})

    //   const adminNameBase64 = result.body.data['ca-admin-user']
    //   const adminName = (new Buffer.from(adminNameBase64, 'base64')).toString('utf8')
    //   return adminName
    // } catch (err) {
    //   return err
    // }
    return "admin";
  },
  getCaPemCert: async function(client) {
    try {
      let result = await client.api.v1
        .namespaces(namespaceNames.CA)
        .secret("hlf-ca-idcert")
        .get({});

      const caBase64PemCert = result.body.data["rca.pem"];
      return caBase64PemCert;
    } catch (err) {
      return err;
    }
  },
  getNodesMspId: async function(client, hlfMemberType, hlfBackendDbType) {
    try {
      let result = await client.api.v1
        .namespaces(namespaceNames.NODES)
        .pods.get({});
      result = result.body.items.filter(pod =>
        pod.metadata.name.startsWith(hlfMemberType)
      );

      let envVariables;
      // with peer nodes and couchDB we have 2 containers in pod - first for couchDB, in other way only 1
      if (hlfMemberType == "peer" && hlfBackendDbType == "couchDB") {
        envVariables = result[0].spec.containers[1].env;
      } else {
        envVariables = result[0].spec.containers[0].env;
      }

      const envName =
        hlfMemberType == "orderer"
          ? "ORDERER_GENERAL_LOCALMSPID"
          : "CORE_PEER_LOCALMSPID";

      envVariables.forEach(envVar => {
        if (envVar.name == envName) {
          result = envVar.value;
        }
      });
      return result;
    } catch (err) {
      return err;
    }
  }
};

const namespaceNames = {
  TOOLS: "tools",
  CA: "ca",
  NODES: "hlf",
  ADMIN: "hlf-admin",
  STATUS: "metadata",
  NGINX: "nginx"
};
