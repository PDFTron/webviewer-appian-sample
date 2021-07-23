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