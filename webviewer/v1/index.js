Appian.Component.onNewValue(function (newValues) {
  const { key, url, appianDocId, docAccessConnectedSystem, disabledElements, fullAPI, enableRedaction, userDisplayName, documentFolder, saveAsNewDocument, documentName } = newValues;

  if (checkNull(docAccessConnectedSystem)) {
    Appian.Component.setValidations(
      "Document Access connected system should not be null or empty"
    );
    return;
  }

  async function getDocumentFromAppian(docId) {
    var docData, docName, message;
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
      documentId: docId,
    };

    await Appian.Component.invokeClientApi(
      docAccessConnectedSystem,
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

  WebViewer(
    {
      path: "/suite/rest/a/content/latest/webcontent/webviewer/lib/",
      licenseKey: key,
      backendType: "ems",
      enableFilePicker: true,
      fullAPI: fullAPI,
      enableRedaction: enableRedaction,
      disabledElements: disabledElements
    },
    document.getElementById("viewer")
  ).then((instance) => {
    const { docViewer, annotManager, CoreControls } = instance;

    if (!checkNull(userDisplayName)) {
      annotManager.setCurrentUser(userDisplayName);
    }   

    instance.setHeaderItems((header) => {
      header.push({
        type: "actionButton",
        img: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M0 0h24v24H0z" fill="none"/><path d="M17 3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V7l-4-4zm-5 16c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3zm3-10H5V5h10v4z"/></svg>',
        onClick: async () => {
          let docId, message;
          const createNewDoc = saveAsNewDocument ? saveAsNewDocument : false;
          const doc = docViewer.getDocument();
          const xfdfString = await annotManager.exportAnnotations();
          const data = await doc.getFileData({
            xfdfString,
          });

          const base64Document = convertArrayBufferToBase64(data);

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

          const documentAppianFolder = documentFolder ? Number(documentFolder) : 0;
          console.log(documentAppianFolder);
          console.log(createNewDoc);

          var payload = {
            base64: base64Document,
            createNewDocument: createNewDoc,
            documentFolder: documentAppianFolder
          };
          
          const fileName = doc.getFilename() ? `${doc.getFilename()}_${Date.now()}` : "myfile.pdf";
          if (createNewDoc) payload.newDocName = documentName !== '' ? documentName : fileName;
          else payload.documentId = Number(appianDocId);

          await Appian.Component.invokeClientApi(
            docAccessConnectedSystem,
            "WebViewerStorageClientApi",
            payload
          )
            .then(handleClientApiResponse)
            .catch(handleError);

          return docId;
        },
      });
    });

    if (!checkNull(url)) {
      instance.loadDocument(url);
    } else if (!checkNull(appianDocId)) {
      if (appianDocId.length === 1) {
        getDocumentFromAppian(appianDocId[0]).then(
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
                  instance.loadDocument(documentBuffer, { filename: documentData.docName, extension: documentData.docName.split('.').pop() });
                }
              );
            }
          },
          function (error) {
            Appian.Component.setValidations(
              "Unable to fetch document from Appian"
            );
            console.error(error);
          }
        );
      } else if (appianDocId.length > 1) {
        let promiseArray = [];
        let docName = '';
        appianDocId.forEach(id => {
          promiseArray.push(getDocumentFromAppian(id));
        });
        Promise.all(promiseArray).then(values => {
          let blobPromiseArray = [];

          values.forEach(function (documentData) {
            if (
              checkNull(documentData.docBase64) ||
              checkNull(documentData.docName)
            ) {
              Appian.Component.setValidations(
                "Unable to fetch document from Appian"
              );
              return;
            } else {
              blobPromiseArray.push(convertBase64ToArrayBuffer(documentData.docBase64));
              if (docName === '') {
                // get the name of the first document
                docName = documentData.docName;
              }
              Promise.all(blobPromiseArray).then(values => {
                mergeDocuments(values).then(mergedPdf => {
                  // merged pdf, here you can download it using mergedPdf.getFileData
                  instance.loadDocument(mergedPdf, { filename: docName });
                });
                
                // recursive function with promise 
                function mergeDocuments(urlArray, nextCount = 1, doc = null) {
                  return new Promise(async function(resolve, reject) {
                    if (!doc) {
                      doc = await CoreControls.createDocument(urlArray[0]);
                    }
                    const newDoc = await CoreControls.createDocument(urlArray[nextCount]);
                    const newDocPageCount = newDoc.getPageCount();
                
                    // create an array containing 1…N
                    const pages = Array.from({ length: newDocPageCount }, (v, k) => k + 1);
                    const pageIndexToInsert = doc.getPageCount() + 1;
                    // in this example doc.getPageCount() returns 3
                
                    doc.insertPages(newDoc, pages, pageIndexToInsert)
                      .then(result => resolve({
                        next: urlArray.length - 1 > nextCount,
                        doc: doc,
                      })
                    );
                    // end Promise
                  }).then(res => {
                    return res.next ?
                      mergeDocuments(urlArray, nextCount + 1, res.doc) :
                      res.doc;
                  });
                }
              });
            }
          },
          function (error) {
            Appian.Component.setValidations(
              "Unable to fetch document from Appian"
            );
            console.error(error);
          });
        });
      }
      
    }

    docViewer.on("documentLoaded", () => {
      // call methods relating to the loaded document
    });
  });
});
