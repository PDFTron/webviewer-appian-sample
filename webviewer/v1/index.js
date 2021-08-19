let isInitialized = false;
let wvInstance;

Appian.Component.onNewValue(function (newValues) { 
  const { key, url, appianDocId, docAccessConnectedSystem, disabledElements, fullAPI, enableRedaction, userDisplayName, documentFolder, enableExtractPagesToAppian } = newValues;
  console.log(newValues);

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

  async function loadDocument() {
    const { CoreControls } = wvInstance;
    if (!checkNull(url)) {
      wvInstance.loadDocument(url);
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
                  wvInstance.loadDocument(documentBuffer, { filename: documentData.docName, extension: documentData.docName.split('.').pop() });
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
                  wvInstance.loadDocument(mergedPdf, { filename: docName });
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
  }

  if (!isInitialized) {
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
      const { docViewer, annotManager } = instance;
      wvInstance = instance;
      isInitialized = true;

      const modalSaveAs = {
        dataElement: 'saveAsDocument',
        render: function renderCustomModal(){
          let div = document.createElement("div");
          div.classList.add('Modal');
          div.classList.add('WarningModal');
    
          let divContainer = document.createElement("div");
          divContainer.classList.add('container');
    
          let divHeader = document.createElement("div");
          divHeader.classList.add('header');
          divHeader.innerText = 'Save as';
    
          let divBody = document.createElement("div");
          divBody.classList.add('body');
          divBody.style = 'display: flex; flex-direction: column;';
          divBody.innerText = 'Provide a new document name:';
    
          let divInput = document.createElement('input');
          divInput.type = 'text';
          divInput.id = 'appian_document_name_save';
          divInput.style = 'height: 28px; margin-top: 10px;';
    
          let divFooter = document.createElement("div");
          divFooter.classList.add('footer');
    
          let divCancelButton = document.createElement("div");
          divCancelButton.classList.add('Button');
          divCancelButton.classList.add('cancel');
          divCancelButton.classList.add('modal-button');
          divCancelButton.innerText = 'Cancel';
          divCancelButton.addEventListener('click', () => {
            instance.UI.closeElements([modalSaveAs.dataElement]);
          });
    
          let divConfirmButton = document.createElement("div");
          divConfirmButton.classList.add('Button');
          divConfirmButton.classList.add('confirm');
          divConfirmButton.classList.add('modal-button');
          divConfirmButton.innerText = 'Save';
          divConfirmButton.addEventListener('click', async () => {
            let docId, message;
            let documentName = instance.UI.iframeWindow.document.getElementById('appian_document_name_save').value;

            if (documentName === '') {
              instance.UI.closeElements([modalSaveAs.dataElement]);  
              instance.showErrorMessage('No name is provided. Please provide a name and try again.');
              setTimeout(() => {
                instance.closeElements(['errorModal']);
              }, 2000)
              return;
            }

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
  
            const documentAppianFolder = documentFolder ? documentFolder : 0;
  
            var payload = {
              base64: base64Document,
              createNewDocument: true,
              documentFolder: documentAppianFolder
            };
            
            payload.newDocName = documentName;
  
            await Appian.Component.invokeClientApi(
              docAccessConnectedSystem,
              "WebViewerStorageClientApi",
              payload
            )
              .then(handleClientApiResponse)
              .catch(handleError);
  
            instance.UI.closeElements([modalSaveAs.dataElement]);  

            return docId;
          });
    
          divBody.appendChild(divInput);
          divFooter.appendChild(divCancelButton);
          divFooter.appendChild(divConfirmButton);
          divContainer.appendChild(divHeader);
          divContainer.appendChild(divBody);
          divContainer.appendChild(divFooter);
          div.appendChild(divContainer);
    
          return div;
        }
      }

      const modalExtractPages = {
        dataElement: 'extractPagesDocument',
        render: function renderCustomModal(){
          let div = document.createElement("div");
          div.classList.add('Modal');
          div.classList.add('WarningModal');
    
          let divContainer = document.createElement("div");
          divContainer.classList.add('container');
    
          let divHeader = document.createElement("div");
          divHeader.classList.add('header');
          divHeader.innerText = 'Save as';
    
          let divBody = document.createElement("div");
          divBody.classList.add('body');
          divBody.style = 'display: flex; flex-direction: column;';
          divBody.innerText = 'Provide a new document name:';
    
          let divInput = document.createElement('input');
          divInput.type = 'text';
          divInput.id = 'appian_document_name_extract';
          divInput.style = 'height: 28px; margin-top: 10px;';
    
          let divFooter = document.createElement("div");
          divFooter.classList.add('footer');
    
          let divCancelButton = document.createElement("div");
          divCancelButton.classList.add('Button');
          divCancelButton.classList.add('cancel');
          divCancelButton.classList.add('modal-button');
          divCancelButton.innerText = 'Cancel';
          divCancelButton.addEventListener('click', () => {
            instance.UI.closeElements([modalExtractPages.dataElement]);
          });
    
          let divConfirmButton = document.createElement("div");
          divConfirmButton.classList.add('Button');
          divConfirmButton.classList.add('confirm');
          divConfirmButton.classList.add('modal-button');
          divConfirmButton.innerText = 'Save';
          divConfirmButton.addEventListener('click', async () => {
              let docId, message;

              let documentName = instance.UI.iframeWindow.document.getElementById('appian_document_name_extract').value;

              const doc = docViewer.getDocument();
              const pagesToExtract = instance.getSelectedThumbnailPageNumbers();

              if (documentName === '') {
                instance.UI.closeElements([modalExtractPages.dataElement]);  
                instance.showErrorMessage('No name is provided. Please provide a name and try again.');
                setTimeout(() => {
                  instance.closeElements(['errorModal']);
                }, 2000)
                return;
              } else if (pagesToExtract.length === 0) {
                instance.UI.closeElements([modalExtractPages.dataElement]);  
                instance.showErrorMessage('No pages selected. Please select pages and try again.');
                setTimeout(() => {
                  instance.closeElements(['errorModal']);
                }, 2000)
                return;
              }
    
              const annotList = annotManager.getAnnotationsList().filter(annot => pagesToExtract.indexOf(annot.PageNumber) > -1);
              const xfdfString = await annotManager.exportAnnotations({ annotList });
              const data = await doc.extractPages(pagesToExtract, xfdfString);
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
    
              const documentAppianFolder = documentFolder ? documentFolder : 0;
    
              var payload = {
                base64: base64Document,
                createNewDocument: true,
                documentFolder: documentAppianFolder
              };
              
              payload.newDocName = documentName;
    
              await Appian.Component.invokeClientApi(
                docAccessConnectedSystem,
                "WebViewerStorageClientApi",
                payload
              )
                .then(handleClientApiResponse)
                .catch(handleError);

              instance.UI.closeElements([modalExtractPages.dataElement]);  
    
              return docId;
          });
    
          divBody.appendChild(divInput);
          divFooter.appendChild(divCancelButton);
          divFooter.appendChild(divConfirmButton);
          divContainer.appendChild(divHeader);
          divContainer.appendChild(divBody);
          divContainer.appendChild(divFooter);
          div.appendChild(divContainer);
    
          return div;
        }
      }
      instance.UI.setCustomModal(modalSaveAs);
      instance.UI.setCustomModal(modalExtractPages);
  
      if (!checkNull(userDisplayName)) {
        annotManager.setCurrentUser(userDisplayName);
      }   
  
      instance.setHeaderItems((header) => {
        // extract pages to Appian as a new document
        if (enableExtractPagesToAppian) {
          header.push({
            type: "actionButton",
            img: '<svg data-name="Layer 1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><defs><style>.cls-1{fill:#868e96;}</style></defs><path class="cls-1" d="M16.49,13.54h1.83V9.25s0,0,0-.06a.59.59,0,0,0,0-.23.32.32,0,0,0,0-.09.8.8,0,0,0-.18-.27l-5.5-5.5a.93.93,0,0,0-.26-.18l-.09,0a1,1,0,0,0-.24,0l-.05,0H5.49A1.84,1.84,0,0,0,3.66,4.67V19.33a1.84,1.84,0,0,0,1.83,1.84H11V19.33H5.49V4.67H11V9.25a.92.92,0,0,0,.92.92h4.58Z"/><path class="cls-1" d="M20.21,17.53,17.05,15a.37.37,0,0,0-.6.29v1.6H12.78v1.84h3.67v1.61a.37.37,0,0,0,.6.29l3.16-2.53A.37.37,0,0,0,20.21,17.53Z"/></svg>',
            onClick: () => {
              instance.UI.openElements([modalExtractPages.dataElement]);
            }
          });
        }
        
        // update an existing document back to Appian
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
  
            const documentAppianFolder = documentFolder ? documentFolder : 0;
  
            var payload = {
              base64: base64Document,
              createNewDocument: false,
              documentFolder: documentAppianFolder
            };
            
            payload.documentId = appianDocId[0];
  
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
  
        // save as a new document back to Appian
        header.push({
          type: "actionButton",
          img: '<svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 0 24 24" width="24px"><path d="M0 0h24v24H0z" fill="none"/><path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 14h-3v3h-2v-3H8v-2h3v-3h2v3h3v2zm-3-7V3.5L18.5 9H13z"/></svg>',
          onClick: async () => {
            instance.UI.openElements([modalSaveAs.dataElement]);
          },
        });
  
      });

      loadDocument();
  
      docViewer.on("documentLoaded", () => {
        // call methods relating to the loaded document
      });
    });

  } else {
    loadDocument();
  }

  
});
