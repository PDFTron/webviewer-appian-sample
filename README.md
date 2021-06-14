# WebViewer - Appian Component Plugin

:construction: This is a work in progress and it should not be used in production.

[WebViewer](https://www.pdftron.com/documentation/web/) is a powerful JavaScript-based PDF Library that's part of the [PDFTron PDF SDK](https://www.pdftron.com). It provides a slick out-of-the-box responsive UI that interacts with the core library to view, annotate and manipulate PDFs that can be embedded into any web project.

![WebViewer UI](https://www.pdftron.com/downloads/pl/webviewer-ui.png)

This repo is specifically designed for any users interested in integrating WebViewer into Mendix low-code app. You can watch [a video here](https://youtu.be/a9HNVzbmDLM) to help you get started.

## Initial setup

This sample was built by following the [guide](https://docs.appian.com/suite/help/21.2/develop-first-component.html). 

## Package and Deploy

Follow the steps from [`Package and Deploy`](https://docs.appian.com/suite/help/21.2/develop-first-component.html#package-and-deploy) to test it in your Appian environment. 

## Parameters 

It has two fields you can pass `key` and `url`. Key is optional and if not provided, it will run in demo mode. URL is a URL to the file, you would like to open.
