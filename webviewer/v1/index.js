let isInitialized = false;
let wvInstance;
let currentDocId;

Appian.Component.onNewValue(function (newValues) { 
  const { key, url, appianDocId, docAccessConnectedSystem, disabledElements, fullAPI, enableRedaction, userDisplayName, documentFolder, enableExtractPagesToAppian, xfdfAnnotationData } = newValues;

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
      wvInstance.docViewer.on("documentLoaded", async () => {
        if (xfdfAnnotationData && xfdfAnnotationData !== '') {
          await wvInstance.docViewer.getAnnotationManager().importAnnotations(xfdfAnnotationData);
        }
      });
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
                  currentDocId = appianDocId[0];
                  wvInstance.docViewer.on("documentLoaded", async () => {
                    if (xfdfAnnotationData && xfdfAnnotationData !== '') {
                      await wvInstance.docViewer.getAnnotationManager().importAnnotations(xfdfAnnotationData);
                    }
                  });
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
        currentDocId = appianDocId[0];
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
                  wvInstance.docViewer.on("documentLoaded", async () => {
                    if (xfdfAnnotationData && xfdfAnnotationData !== '') {
                      await wvInstance.docViewer.getAnnotationManager().importAnnotations(xfdfAnnotationData);
                    }
                  });
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
        enableFilePicker: true,
        fullAPI: fullAPI,
        enableRedaction: enableRedaction,
        backendType: 'asm',
        loadAsPDF: true,
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

            console.log(docId);
            Appian.Component.saveValue('newSavedDocumentId', docId);

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
          divHeader.innerText = 'Extract and save as';
    
          let divBody = document.createElement("div");
          divBody.classList.add('body');
          divBody.style = 'display: flex; flex-direction: column; width: 100%;';
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
          divConfirmButton.classList.add('cancel');
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
                instance.UI.openElements(['leftPanel']); 
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
              Appian.Component.saveValue('newSavedDocumentId', docId);
    
              return docId;
          });
    
          let divConfirmDeleteButton = document.createElement("div");
          divConfirmDeleteButton.classList.add('Button');
          divConfirmDeleteButton.classList.add('confirm');
          divConfirmDeleteButton.classList.add('modal-button');
          divConfirmDeleteButton.innerText = 'Save and remove pages';
          divConfirmDeleteButton.addEventListener('click', async () => {
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
                instance.UI.openElements(['leftPanel']); 
                setTimeout(() => {
                  instance.closeElements(['errorModal']);
                }, 2000)
                return;
              } else if (pagesToExtract.length === docViewer.getPageCount()) {
                instance.UI.closeElements([modalExtractPages.dataElement]);  
                instance.showErrorMessage('You cannot extract or delete all pages. Please select smaller range and try again.');
                setTimeout(() => {
                  instance.closeElements(['errorModal']);
                }, 2000)
                return;
              }
    
              const annotList = annotManager.getAnnotationsList().filter(annot => pagesToExtract.indexOf(annot.PageNumber) > -1);
              const xfdfString = await annotManager.exportAnnotations({ annotList });
              const data = await doc.extractPages(pagesToExtract, xfdfString);
              const base64Document = convertArrayBufferToBase64(data);

              // remove the pages selected from the original document
              await docViewer.getDocument().documentCompletePromise();
              await doc.removePages(pagesToExtract);
    
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
              Appian.Component.saveValue('newSavedDocumentId', docId);
    
              return docId;
          });
    
          divBody.appendChild(divInput);
          divFooter.appendChild(divCancelButton);
          divFooter.appendChild(divConfirmButton);
          divFooter.appendChild(divConfirmDeleteButton);
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
            title: "Extract selected pages",
            dataElement: "extractAppianButton",
            img: '<svg data-name="Layer 1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><defs><style>.cls-1{fill:#868e96;}</style></defs><path class="cls-1" d="M16.49,13.54h1.83V9.25s0,0,0-.06a.59.59,0,0,0,0-.23.32.32,0,0,0,0-.09.8.8,0,0,0-.18-.27l-5.5-5.5a.93.93,0,0,0-.26-.18l-.09,0a1,1,0,0,0-.24,0l-.05,0H5.49A1.84,1.84,0,0,0,3.66,4.67V19.33a1.84,1.84,0,0,0,1.83,1.84H11V19.33H5.49V4.67H11V9.25a.92.92,0,0,0,.92.92h4.58Z"/><path class="cls-1" d="M20.21,17.53,17.05,15a.37.37,0,0,0-.6.29v1.6H12.78v1.84h3.67v1.61a.37.37,0,0,0,.6.29l3.16-2.53A.37.37,0,0,0,20.21,17.53Z"/></svg>',
            onClick: () => {
              instance.UI.openElements([modalExtractPages.dataElement]);
            }
          });
        }
        
        // update an existing document back to Appian
        header.push({
          type: "actionButton",
          title: "Save",
          dataElement: "saveAppianButton",
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

            payload.documentId = currentDocId;
  
            await Appian.Component.invokeClientApi(
              docAccessConnectedSystem,
              "WebViewerStorageClientApi",
              payload
            )
              .then(handleClientApiResponse)
              .catch(handleError);

              Appian.Component.saveValue('newSavedDocumentId', currentDocId);
  
            return docId;
          },
        });
  
        // save as a new document back to Appian
        header.push({
          type: "actionButton",
          title: "Save as",
          dataElement: "saveAsAppianButton",
          img: `<svg width="auto" height="auto" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M21.3439 12.2929C20.9534 11.9024 20.3202 11.9024 19.9297 12.2929L18.9611 13.2615L20.6786 14.979L21.6472 14.0104C22.0377 13.6199 22.0377 12.9867 21.6472 12.5962L21.3439 12.2929Z" fill="black"/>
          <path d="M19.5615 16.0961L17.844 14.3786L12.2584 19.9642L12 21.9401L13.9759 21.6817L19.5615 16.0961Z" fill="black"/>
          <path fill-rule="evenodd" clip-rule="evenodd" d="M9.05087 21H4C2.897 21 2 20.103 2 19V5C2 3.897 2.897 3 4 3H15C15.266 3 15.52 3.105 15.707 3.293L19.707 7.293C19.895 7.48 20 7.735 20 8V10.0509L18.0003 12.0505L18 8.414L14.586 5H14V9H13H12H10H8H6V5H4V19H6V14C6 12.897 6.897 12 8 12H14C15.103 12 16 12.897 16 14V14.0509L14 16.0509V14H8V19H11.0509L9.05087 21ZM10 7H12V5H10V7Z" fill="black"/>
          </svg>`,
          onClick: async () => {
            instance.UI.openElements([modalSaveAs.dataElement]);
          },
        });

        // save as annotation string
        header.push({
          type: "actionButton",
          title: "Save Annotations",
          dataElement: "saveAnnotationAppianButton",
          img: `<svg xmlns="http://www.w3.org/2000/svg" enable-background="new 0 0 24 24" height="24" viewBox="0 0 24 24" width="24"><g><path d="M0,0h24v24H0V0z" fill="none"/></g><g><g><path d="M19,3h-4.18C14.4,1.84,13.3,1,12,1S9.6,1.84,9.18,3H5C3.9,3,3,3.9,3,5v14c0,1.1,0.9,2,2,2h14c1.1,0,2-0.9,2-2V5 C21,3.9,20.1,3,19,3z M12,2.75c0.41,0,0.75,0.34,0.75,0.75S12.41,4.25,12,4.25s-0.75-0.34-0.75-0.75S11.59,2.75,12,2.75z M19,19H5 V5h14V19z"/><polygon points="15.08,11.03 12.96,8.91 7,14.86 7,17 9.1,17"/><path d="M16.85,9.27c0.2-0.2,0.2-0.51,0-0.71l-1.41-1.41c-0.2-0.2-0.51-0.2-0.71,0l-1.06,1.06l2.12,2.12L16.85,9.27z"/></g></g></svg>`,
          onClick: async () => {
            const annots = await annotManager.exportAnnotations();
            Appian.Component.saveValue('xfdfAnnotationData', annots);
          },
        });
  
      });

      loadDocument();
    });

  } else {
    loadDocument();
  }

  
});
