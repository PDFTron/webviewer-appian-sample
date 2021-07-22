Appian.Component.onNewValue(function (newValues) {
  const license = newValues.key;
  const appianDocId = newValues.appianDocId;

  let URLtoFile =
    "https://pdftron.s3.amazonaws.com/downloads/pl/webviewer-demo.pdf";

  if (newValues.url) {
    URLtoFile = newValues.url;
  }

  if (checkNull(appianDocId)) {
    Appian.Component.setValidations(
      "Appian Document Id should not be null or empty"
    );
    return;
  }

  if (checkNull(connectedSystem)) {
    Appian.Component.setValidations(
      "Document Access connected system should not be null or empty"
    );
    return;
  }

  WebViewer(
    {
      path: "/suite/rest/a/content/latest/webcontent/webviewer/lib/",
      licenseKey: license,
      backendType: "ems",
      enableFilePicker: true,
    },
    document.getElementById("viewer")
  ).then((instance) => {
    const { docViewer, annotManager } = instance;

    instance.setHeaderItems((header) => {
      header.push({
        type: "actionButton",
        img: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M0 0h24v24H0z" fill="none"/><path d="M17 3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V7l-4-4zm-5 16c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3zm3-10H5V5h10v4z"/></svg>',
        onClick: async () => {
          let docId, message;
          const doc = docViewer.getDocument();
          const xfdfString = await annotManager.exportAnnotations();
          const data = await doc.getFileData({
            xfdfString,
          });
          const arr = new Uint8Array(data);
          const docBase64 = convertArrayBufferToBase64(arr);

          function handleClientApiResponse(response) {
            if (response.payload.error) {
              console.error(
                "Connected system response: " + response.payload.error
              );
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
        },
      });
    });

    getDocumentFromAppian(appianDocId).then(
      function (documentData) {
        if (
          checkNull(documentData.docBase64) ||
          checkNull(documentData.docName)
        ) {
          Appian.Component.setValidations(
            "Unable to fetch document from Appian"
          );
          return;
        } else {
          convertBase64ToArrayBuffer(documentData.docBase64).then(
            (documentBuffer) => {
              instance.loadDocument(documentBuffer.arrayBuffer());
            }
          );
          documentName = documentData.docName;
        }
      },
      function (error) {
        Appian.Component.setValidations("Unable to fetch document from Appian");
        console.error(error);
      }
    );

    docViewer.on("documentLoaded", () => {
      // call methods relating to the loaded document
    });
  });
});
