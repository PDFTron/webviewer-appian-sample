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

function convertArrayBufferToBase64(buffer) {
  var binary = "";
  var bytes = new Uint8Array(buffer);
  for (var i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}