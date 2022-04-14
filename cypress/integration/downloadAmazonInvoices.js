import { jsPDF } from "jspdf";
import html2Canvas from "html2canvas";
import { parse } from "papaparse";
import * as XLSX from "xlsx";

/**
 * Check that the input is a non-empty string
 * @param {string} input
 * @returns true if input is a non-empty string
 */
const checkStringInput = input => typeof input === "string" && input.length > 0;

/**
 * Check that all elements in the inputs array are non-empty strings
 * @param {string[]} inputs
 * @returns true if all elements are non-empty strings
 */
const checkStringInputs = inputs =>
  inputs.every(input => checkStringInput(input));

/**
 * Download an invoice and save it as a PDF.
 * @param {string} orderId - the Amazon.com order ID
 * @param {string} pdfFilename - the filename to use when creating the PDF
 * @param {string} orderHistoryHref - the link for the Order History page
 */
const downloadInvoice = (orderId, pdfFilename, orderHistoryHref) => {
  if (checkStringInputs([orderId, pdfFilename, orderHistoryHref])) {
    cy.get("input#searchOrdersInput").type(orderId);

    cy.get("form#searchForm").submit();

    cy.get("div#ordersContainer").contains("View invoice").click();

    cy.location("pathname", { timeout: 2000 }).should(
      "include",
      "gp/css/summary/print.html"
    );

    cy.get("body")
      .first()
      .then($body => {
        html2Canvas($body[0]).then(canvas => {
          const imgData = canvas.toDataURL("image/png");
          const pdf = new jsPDF({
            orientation: "portrait",
          });
          const imgProps = pdf.getImageProperties(imgData);
          const pdfWidth = pdf.internal.pageSize.getWidth();
          const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;

          pdf.addImage(imgData, "PNG", 0, 0, pdfWidth, pdfHeight);

          pdf.save(`${pdfFilename}.pdf`);
        });
      });
  }

  cy.visit(orderHistoryHref);
};

/**
 * Download a list of invoices
 * @param {object[]} invoices the array of invoice objects. Each must have an `order_id` property.
 * If a `pdf_filename` property is included, it will be used as the PDF filename; otherwise, the
 * `order_id` property will be used.
 * @param {string} orderHistoryHref the link to the order history page
 * @param {string} dataSource the path to the spreadsheet that was used to read the list of invoices
 */
const downloadInvoices = (invoices, orderHistoryHref, dataSource) => {
  const filtered = invoices.filter(invoice =>
    checkStringInputs([invoice.order_id])
  );

  cy.log(`Downloading ${filtered.length} invoices from ${dataSource}`);

  cy.wrap(filtered).each((invoice, index) => {
    const { order_id, pdf_filename } = invoice;

    if (pdf_filename && pdf_filename.length > 0) {
      cy.log(
        `Downloading invoice ${index + 1} of ${
          filtered.length
        } with order ID: ${order_id} to file: ${pdf_filename}.pdf`
      );

      // If pdf_filename is included, use it as the PDF filename
      downloadInvoice(order_id, pdf_filename, orderHistoryHref);
    } else {
      cy.log(
        `Downloading invoice ${index + 1} of ${
          filtered.length
        } with order ID: ${order_id} to file: ${order_id}.pdf`
      );

      // Otherwise, use the order_id as the PDF filename
      downloadInvoice(order_id, order_id, orderHistoryHref);
    }
  });
};

/**
 * Download all invoices listed in a CSV file as PDF files, then save them to the downloads folder.
 * See detailed notes in README.md.
 */
describe("downloadAmazonInvoices", () => {
  it("downloads all invoices from ./data/invoices.csv as PDF files", () => {
    // Check for required environment variables
    const email = Cypress.env("email");
    const password = Cypress.env("password");

    cy.wrap(email).should("not.be.empty");
    cy.wrap(password).should("not.be.empty");

    // Go to amazon.com and sign in

    cy.visit("https://www.amazon.com/");

    cy.get("#nav-link-accountList").focus();

    cy.get(".nav-action-button").last().click();

    cy.location("pathname", { timeout: 2000 }).should("include", "ap/signin");

    cy.get("input#ap_email").type(Cypress.env("email"));

    cy.get("input#continue").click();

    cy.get("input#ap_password").type(Cypress.env("password"));

    cy.get("input#signInSubmit").click();

    cy.location("href", { timeout: 2000 }).should(
      "include",
      "?ref_=nav_custrec_signin&"
    );

    // Go to Orders page

    cy.get("a#nav-orders").click();

    cy.location("pathname", { timeout: 2000 }).should(
      "include",
      "gp/css/order-history"
    );

    cy.location().then(loc => {
      // Save a reference to the Orders page location so we can come back to it
      const orderHistoryHref = loc.href;

      let foundSpreadsheet = false;

      // Check for existence of ./data/invoices.csv
      cy.task("readFileMaybe", "./data/invoices.csv").then(maybeFile => {
        if (maybeFile === null) {
          cy.log("Did not find anything in ./data/invoices.csv");
        } else {
          foundSpreadsheet = true;

          // If found, parse ./data/invoices.csv and download all invoices
          const invoices = parse(maybeFile, {
            header: true,
            complete: csvData => csvData.data,
          }).data;

          downloadInvoices(invoices, orderHistoryHref, "./data/invoices.csv");
        }
      });

      // If we did not find ./data/invoices.csv, check for existence of ./data/invoices.xlsx
      if (!foundSpreadsheet) {
        cy.task("readFileMaybeXLSX", "./data/invoices.xlsx").then(workBook => {
          if (workBook === null) {
            cy.log("Did not find anything in ./data/invoices.xlsx");
          } else {
            // If found, parse ./data/invoices.xlsx and download all invoices
            const invoices = XLSX.utils.sheet_to_json(workBook.Sheets.Sheet1);

            downloadInvoices(
              invoices,
              orderHistoryHref,
              "./data/invoices.xlsx"
            );
          }
        });
      }
    });

    // Sign out

    cy.get("[data-nav-ref='nav_youraccount_btn']").trigger("mouseover");

    cy.get("#nav-item-signout").click();

    cy.location("pathname", { timeout: 2000 }).should("include", "ap/signin");
  });
});
