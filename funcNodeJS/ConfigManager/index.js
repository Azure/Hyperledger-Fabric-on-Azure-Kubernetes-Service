module.exports = async function(context, req) {
  const action = req.params.action;
  const method = req.method;

  const fs = require("fs");

  const { createClient } = require("./k8s-utils");

  // k8s
  const kuberConfig = process.env.KubernetesClusterAdminCredential;
  const client = createClient(kuberConfig);

  // Common hlf data
  const hlfBackendDbType = process.env.hlfBackendDbType;
  const hlfMemberType = process.env.hlfMemberType;
  const hlfOrgName = process.env.hlfOrgName;
  const builder = require("./builder");
  const serverCaName = await builder.getServerCaName(client);
  const orgMSPID = `${hlfOrgName}`;
  const hlfTlsCaCert = await builder.getHlfTlsCaCert(client);
  const nodesNameArray = await builder.getNodesName(
    client,
    hlfMemberType,
    hlfBackendDbType,
    hlfOrgName
  );
  const nodesType = hlfMemberType == "orderer" ? "orderers" : "peers";
  const dnsArray = await builder.getDnsRecords(client);
  const caDns = dnsArray.pop().replace("grpcs", "https");
  const nodesDnsArray = dnsArray;

  let responseData;
  switch (action) {
    case "gateway":
      responseData = await getGateWay();
      break;
    case "admin":
      responseData = await getAdmin();
      break;
    case "ca":
      responseData = await getCA();
      break;
    case "msp":
      responseData = await getMSP();
      break;
    default:
      responseData = `Endpoint "${action}" not found`;
  }

  if (action.search(/^(node\d*)$/) !== -1) {
    const nodeNumber = Number(action.replace("node", ""));
    responseData = await getNode(nodeNumber - 1);
  }

  async function getGateWay() {
    let gatewayString = fs
      .readFileSync(`${__dirname}/models/gateway.json`)
      .toString("utf8");
    gatewayString = gatewayString.replace(/{orgCA}/g, `${hlfOrgName}CA`);
    gatewayString = gatewayString.replace(
      /{ca}/g,
      `${serverCaName}.${hlfOrgName}`
    );
    gatewayString = gatewayString.replace(/{caUrl}/g, caDns);
    gatewayString = gatewayString.replace(/{org1MSP}/g, orgMSPID);
    gatewayString = gatewayString.replace(/{org}/g, hlfOrgName);
    gatewayString = gatewayString.replace(/{nodesType}/g, nodesType);

    let gatewayObject = JSON.parse(gatewayString);
    gatewayObject.certificateAuthorities[
      `${hlfOrgName}CA`
    ].tlsCACerts.pem = hlfTlsCaCert;
    gatewayObject = await builder.addNodesObjectsToGateway(
      gatewayObject,
      nodesType,
      nodesNameArray,
      nodesDnsArray,
      hlfTlsCaCert
    );
    gatewayObject = await builder.addNodesNameToOrganizationsGateway(
      gatewayObject,
      nodesNameArray,
      hlfOrgName,
      nodesType
    );
    const gateway = JSON.stringify(gatewayObject, null, 2);
    return gateway;
  }

  async function getNode(nodeNumber) {
    let nodeString = fs
      .readFileSync(`${__dirname}/models/nodes.json`)
      .toString("utf8");
    let nodeObject = JSON.parse(nodeString);
    const tlsCaCertForNodes = await builder.getHlfTlsCaCert(client);
    const nodesMspId = await builder.getNodesMspId(
      client,
      hlfMemberType,
      hlfBackendDbType
    );
    const nodesArray = await builder.addNodesObjectsToNodes(
      nodeObject,
      nodesMspId,
      nodesNameArray,
      tlsCaCertForNodes,
      nodesDnsArray,
      hlfMemberType
    );
    const node = nodesArray[nodeNumber];
    if (node !== undefined) {
      return node;
    } else {
      return `Error available nodes from 1 to ${nodesArray.length}`;
    }
  }

  async function getAdmin() {
    let adminString = fs
      .readFileSync(`${__dirname}/models/admin.json`)
      .toString("utf8");
    let adminObject = JSON.parse(adminString);
    const adminBase64PemCert = await builder.getAdminPemCert(client);
    const adminName = await builder.getAdminUserName(client);
    const adminBase64PemKey = await builder.getAdminPemKey(client);
    const adminBase64PemTlsCert = await builder.getAdminPemTlsCert(client);
    const adminBase64PemTlsKey = await builder.getAdminPemTlsKey(client);
    adminObject.cert = adminBase64PemCert;
    adminObject.msp_id = orgMSPID;
    adminObject.name = `${adminName}.${hlfOrgName}`;
    adminObject.private_key = adminBase64PemKey;
    adminObject.tls_cert = adminBase64PemTlsCert;
    adminObject.tls_private_key = adminBase64PemTlsKey;
    const admin = JSON.stringify(adminObject, null, 2);
    return admin;
  }

  async function getCA() {
    let caString = fs
      .readFileSync(`${__dirname}/models/CA.json`)
      .toString("utf8");
    let caObject = JSON.parse(caString);
    const caBase64PemCert = await builder.getCaPemCert(client);
    caObject.api_url = caDns;
    caObject.ca_name = serverCaName;
    caObject.msp_id = orgMSPID;
    caObject.name = `${hlfOrgName}CA`;
    caObject.pem = caBase64PemCert;
    caObject.short_name = `${hlfOrgName}CA`;
    const pureDNScaName = caDns.replace("https://", "").replace(":443", "");
    caObject.tlsca_name = pureDNScaName;
    const ca = JSON.stringify(caObject, null, 2);
    return ca;
  }

  async function getMSP() {
    let mspString = fs
      .readFileSync(`${__dirname}/models/msp.json`)
      .toString("utf8");
    let mspObject = JSON.parse(mspString);

    mspObject.msp_id = orgMSPID;
    const adminPemCert = await builder.getAdminPemCert(client);
    mspObject.admincerts = adminPemCert;
    const tlsCaCert = await builder.getHlfTlsCaCert(client);
    mspObject.tlscacerts = Buffer.from(tlsCaCert).toString("base64");
    const cacerts = await builder.getCaPemCert(client);
    mspObject.cacerts = cacerts;

    const msp = JSON.stringify(mspObject, null, 2);
    return msp;
  }

  context.res = {
    status: 200,
    headers: {
      "Content-Type": "application/json"
    },
    body: responseData
  };

  return;
};
