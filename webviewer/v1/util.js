function checkNull(value) {
  if (value === null || value === undefined || value === "") {
    return true;
  } else {
    return false;
  }
}

async function convertBase64ToArrayBuffer(base64) {
  const base64Response = await fetch(`data:application/pdf;base64,${base64}`);
  const blob = await base64Response.blob();
  return blob;
}

async function getDocumentFromAppian(appianDocId) {
  var docData, docName, message;
  function handleClientApiResponse(response) {
    if (response.payload.error) {
      console.error("Connected system response: " + response.payload.error);
      Appian.Component.setValidations(
        "Connected system response: " + response.payload.error
      );
      return;
    }
    docData = response.payload.docData;
    docName = response.payload.docName;

    if (checkNull(docData) || checkNull(docName)) {
      message = "Unable to obtain the doc data from the connected system";
      console.error(message);
      Appian.Component.setValidations(message);
      return;
    } else {
      // Clear any error messages
      Appian.Component.setValidations([]);
    }
  }

  function handleError(response) {
    if (response.error && response.error[0]) {
      console.error(response.error);
      Appian.Component.setValidations([response.error]);
    } else {
      message = "An unspecified error occurred";
      console.error(message);
      Appian.Component.setValidations(message);
    }
  }

  const payload = {
    documentId: appianDocId,
  };

  await Appian.Component.invokeClientApi(
    connectedSystem,
    "WebViewerRetrieveClientApi",
    payload
  )
    .then(handleClientApiResponse)
    .catch(handleError);

  return {
    docBase64: docData,
    docName,
  };
}

async function sendDocumentToAppian(content) {
  var docId, message;

  var docBase64 = convertArrayBufferToBase64(content);

  function handleClientApiResponse(response) {
    if (response.payload.error) {
      console.error("Connected system response: " + response.payload.error);
      Appian.Component.setValidations(
        "Connected system response: " + response.payload.error
      );
      return;
    }
    docId = response.payload.docId;
    if (docId == null) {
      message = "Unable to obtain the doc id from the connected system";
      console.error(message);
      Appian.Component.setValidations(message);
      return;
    } else {
      // Clear any error messages
      Appian.Component.setValidations([]);
      return docId;
    }
  }

  function handleError(response) {
    if (response.error && response.error[0]) {
      console.error(response.error);
      Appian.Component.setValidations([response.error]);
    } else {
      message = "An unspecified error occurred";
      console.error(message);
      Appian.Component.setValidations(message);
    }
  }

  var payload = {
    base64: docBase64,
    createNewDocument: createNewDoc,
  };

  if (createNewDoc) payload.newDocName = uploadDocumentName;
  else payload.documentId = appianDocId;

  await Appian.Component.invokeClientApi(
    connectedSystem,
    "WebViewerStorageClientApi",
    payload
  )
    .then(handleClientApiResponse)
    .catch(handleError);

  return docId;
}
