// The script is deployed as a web app and renders the form
function doGet(e) {
  return HtmlService
    .createTemplateFromFile('forms')
    .evaluate()
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .setTitle("Submit an Article")
    .setFaviconUrl('https://assets.ysjournal.com/articlesubmission/favicon.ico');
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename)
    .getContent();
}

// These arguments are passed by the script embedded into includes.js - For the love of god please preserve the order!
function uploadFileToGoogleDrive(data, file, articletitle, name, email, subject, birthday, school, schooladdress, teacheremail, hub, nationality, biography, abstract, photoData, photoFile, type, refered, howfind, notes) {

  //Log everything
  var logFolder, logFolders = DriveApp.getFoldersByName("Submissions System Logs");
  if (logFolders.hasNext()) { // Checking to see if dropbox exists already.
      logFolder = logFolders.next();
  } else {
      logFolder = DriveApp.createFolder("Submissions System Logs");
  } 
  
  var logs = DocumentApp.create(Utilities.formatDate(new Date(), "GMT", "yyyy-MM-dd'T'HH:mm:ss'Z'"));
  logs.getBody().appendParagraph(name + "| email:" + email + "|school: " + school + "| title: " + articletitle + " |" + abstract + "| teacher:" + teacheremail);
  var logFile = DriveApp.getFileById(logs.getId());
  logFolder.addFile(logFile);
  DriveApp.removeFile(logFile);
  
  //Now let's get down to business  
  try {
 
    var dropbox = (type == "Blog") ? "Submitted Blogs" : "Submitted Articles";
    var folder, folders = DriveApp.getFoldersByName(dropbox);
 
    if (folders.hasNext()) { // Checking to see if dropbox exists already.
      folder = folders.next();
    } else {
      folder = DriveApp.createFolder(dropbox);
    } 
    
    //Check if the subject folder (Physics, Chemistry...) exists
    var subjectFolder, subjectFolders =  folder.getFoldersByName(subject);
    
    if (subjectFolders.hasNext()){ //Check if subject folder exists alread. If not, create a new one.
      subjectFolder = subjectFolders.next();
    } else {
      subjectFolder = folder.createFolder (subject);
    }
    
    var submittedFolder = subjectFolder.createFolder([articletitle, name, type].join(" : "));// Creates our article's folder within its respective subject folder
         
    var contentType = data.substring(5,data.indexOf(';')), 
        bytes = Utilities.base64Decode(data.substr(data.indexOf('base64,')+7)), // This bit was totally stolen, who knows what it does
        blob = Utilities.newBlob(bytes, contentType, file); // Grabs metadata then bundles to blob
    var docsFile = {
      title: articletitle
    };
    docsFile = Drive.Files.insert(docsFile, blob, { // Uploads the document to Google Drive
      convert: true, // Auto-convert to Google Docs format for collaboration
    });
    
    var fileId = docsFile.id;
    var DriveAppFile = DriveApp.getFileById(fileId); // retrieve file in DriveApp scope.
    var FileURL = DriveAppFile.getUrl(); //Retain URL of file for final end message to user
    submittedFolder.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.EDIT);//.addEditor(email); // Sets the sharing permission to links, (no longer)gives the author write access.
    DriveAppFile.addEditor(email);
    
    // All the user needs is the link, then we run this clean up code to organise the files for the editors
    submittedFolder.addFile(DriveAppFile);
    DriveApp.removeFile(DriveAppFile);
    
    var markingGridLink = getMarkingGrid(articletitle,submittedFolder); //Copies the marking grid to the folders needed and create a link
      
    /************ Start Author email ************/
    var template = HtmlService.createTemplateFromFile("submitted").getRawContent();
    
    //Send an email to the Author (and one to ourselves - for posterity)
    var emailList = email;
    
    // Change template variables
    template = template.replace("<? articleName ?>", articletitle);
    template = template.replace("<? authorName ?>", name);
    template = template.replace("<? docLink ?>", FileURL);
    
    
    MailApp.sendEmail({
      to: emailList,
      name: 'Submissions - Young Scientists Journal',
      subject: articletitle + " has been submitted",
      htmlBody: template
    });
     
    /************ End Author Email ************/
 
    Logger.log("Email Sent to Author");
    
    
    //Send a separate email to all the editors affiliated with this subject
    emailList = getSeniorEditorEmail(subject) + ",ysjournal.editorial@gmail.com,submissions@ysjournal.com" ;
    
    MailApp.sendEmail({
     to: emailList,
     subject: "New " + subject + " Submission",
     htmlBody: "Hi Editor, A new "+ subject +" article has been submitted by "+ name +", "+ email +". Please logon to ysjournal.editorial@gmail.com to perform a basic" +
      "data check of the article, a direct link is <a href='" + FileURL + "'>here</a>. If the article passes this check assign it to an editor via Email and Slack, updating the 'Article Database Spreadsheet'" +
      "in the process, and let the author know the article has been accepted from your @ysjournal.com email address. Thanks, Young Scientists Journal.",
   });
    
    Logger.log("Email Sent to Editors");
    
    //Create all the User's data (biography and other personal data)
    var detailDoc = DocumentApp.create('About ' + name);
    var body = detailDoc.getBody();
    
    Logger.log("Detail Doc created");
    
    //Append text to body
    body.appendParagraph ("Name: " + name);
    body.appendParagraph ("Email: " + email);
    body.appendParagraph ("Birthday: " + birthday.substring(0,4)); //We substring the first 6 chars because of data protection - we only want to store the year of birth!
    body.appendParagraph ("School: " + school);
    body.appendParagraph ("School Address: " + schooladdress);
    body.appendParagraph ("Teacher Email: " + teacheremail);
    body.appendParagraph ("Country: " + nationality);
    body.appendParagraph ("Biography: " + biography);
    body.appendParagraph ("Article Summary: " + abstract);
    body.appendParagraph ("How they found us: " + howfind);
    body.appendParagraph ("How they started the article: " + refered);
    
    
    //Move it to where the article is saved
    var detailDocId = detailDoc.getId();
    var detailDocFile = DriveApp.getFileById(detailDocId);
    var submittedFolderID = submittedFolder.getId();
    submittedFolder.addFile (detailDocFile);
    DriveApp.removeFile(detailDocFile);
    
    //Handle the photo upload
    contentType = photoData.substring(5,photoData.indexOf(';')), 
    bytes = Utilities.base64Decode(photoData.substr(photoData.indexOf('base64,')+7)), // This bit was totally stolen, who knows what it does
    blob = Utilities.newBlob(bytes, contentType, photoFile); // Grabs metadata then bundles to blob
    var picsFile = {
      title: name + "'s Profile Picture"
    };
    picsFile = Drive.Files.insert(picsFile, blob, { // Uploads the document to Google Drive
      convert: false, // Auto-convert to Google Docs format for collaboration
    });
    
    var photoFileId = picsFile.id;
    var photoDriveFile = DriveApp.getFileById(photoFileId); // retrieve file in DriveApp scope.

    //Move the photo to be with everything else
    submittedFolder.addFile(photoDriveFile);
    DriveApp.removeFile(photoDriveFile);
    
    
    //Update the article database
    var sheetName = "Article Database";
    var file, files = DriveApp.getFilesByName(sheetName); 
    
    if (files.hasNext ()){
      file = files.next(); 
    } else {
      return "";
    }
    
    var sheet = SpreadsheetApp.openById(file.getId());
    var date = Utilities.formatDate(new Date(), "GMT", "dd-MM-yyyy").toString();
    sheet.appendRow([date, articletitle, subject ,type, name, school, email, "Technical Review", FileURL, "", "", "", "", submittedFolderID, markingGridLink]);
    var row = sheet.getLastRow();
    sheet.getActiveSheet().getRange(row, 1).setNumberFormat('@STRING@');
    
    // That's all for now, folks
    return FileURL;
    
  } catch (f) {
    return f.toString();
  }
 
}

function getEditorEmails (subject){
 
  //This will find a document with a list of editors working in a specific field and then return their emails.
  //The naming convention will be "SUBJECT Editor List" (eg. "Biology Editor List")
  
  var docName = subject + " Editor List";
  var file, files = DriveApp.getFilesByName(docName); //Retrieve the ID
  
  //Check if the doc exists. If it doesn't, return nothing
  if (files.hasNext ()){
   file = files.next(); 
  } else {
    return "";
  }
  
  
  var docId = file.getId();
  var doc = DocumentApp.openById(docId); //Get the doc
  var text = doc.getBody().editAsText().getText(); //Retrieve text as a string
  
  //Split the text by new lines
  result = text.split('\n').join (", ");
  
  return result;
  
}

function getSeniorEditorEmail (subject){
 
  var sheetName = "Senior Editors";
  var file, files = DriveApp.getFilesByName(sheetName); //Retrieve the ID

  //Check if the doc exists. If it doesn't, return nothing
  if (files.hasNext ()){
   file = files.next(); 
  } else {
    return "";
  }

  var data = SpreadsheetApp.openById(file.getId()).getActiveSheet().getDataRange().getValues();
  //Find the right author
  for (var i = 1; i < data.length; i++){
    Logger.log(data[i][0]);
    if (data [i][0] == subject){
     return data[i][1]; 
    }
    
  }
  
  //The everything editor if this fails
  return data[data.length-1][1];
  
}

function getMarkingGrid(title, folder){
  //This will find the marking grid and copy it to the newly created folder
  
  var docName = "Marking Grid";
  var file, files = DriveApp.getFilesByName(docName); //Retrieve the ID
  
  //Check if the doc exists. If it doesn't, return nothing
  if (files.hasNext ()){
   file = files.next(); 
  } else {
    return "";
  }
  
  
  var newMarkingGrid = file.makeCopy("Marking Grid for " + title, folder); // Names the grid with Article title and puts it in the correct folder
  
  newMarkingGrid.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.EDIT);
  var url = newMarkingGrid.getUrl();
  
  return url;
}

function getHubs (){
 
  var sheetName = "Hubs List";
  var file, files = DriveApp.getFilesByName(sheetName); //Retrieve the ID
  
  //Check if the doc exists. If it doesn't, return nothing
  if (files.hasNext ()){
   file = files.next(); 
  } else {
    return "";
  }
  
  var data = SpreadsheetApp.openById(file.getId()).getActiveSheet().getDataRange().getValues();
  return data;
}

function setSharing() {
  var daddyfolder = DriveApp.getFolderById("0B9zKY3g4_lx3T01UTHBoSGpLS3M");
  
  var folders = daddyfolder.getFolders();
  
  
  
  while (folders.hasNext()) {
    var folder = folders.next();
    folder.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.EDIT);
    
    }
  }

  
  
  
  


function test() {
 //Update the article database
    var sheetName = "Article Database";
    var file, files = DriveApp.getFilesByName(sheetName); 
    
    if (files.hasNext ()){
      file = files.next(); 
    } else {
      return "";
    }
    
    var sheet = SpreadsheetApp.openById(file.getId());
    var date = Utilities.formatDate(new Date(), "GMT", "dd-MM-yyyy").toString();
    sheet.appendRow([date]);
   var row = sheet.getLastRow();
    sheet.getActiveSheet().getRange(row, 1).setNumberFormat('@STRING@');
}