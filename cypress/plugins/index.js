/// <reference types="cypress" />
// ***********************************************************
// This example plugins/index.js can be used to load plugins
//
// You can change the location of this file or turn off loading
// the plugins file with the 'pluginsFile' configuration option.
//
// You can read more here:
// https://on.cypress.io/plugins-guide
// ***********************************************************

// This function is called when a project is opened or re-opened (e.g. due to
// the project's config changing)

require("dotenv").config();

const fs = require("fs");
const XLSX = require("xlsx");

/**
 * @type {Cypress.PluginConfig}
 */
// eslint-disable-next-line no-unused-vars
module.exports = (on, config) => {
  // `on` is used to hook into various events Cypress emits
  // `config` is the resolved Cypress config

  config.env.email = process.env.EMAIL;
  config.env.password = process.env.PASSWORD;

  on("task", {
    readFileMaybe(filename) {
      if (fs.existsSync(filename)) {
        return fs.readFileSync(filename, "utf8");
      }

      return null;
    },
    readFileMaybeXLSX(filename) {
      if (fs.existsSync(filename)) {
        return XLSX.readFile(filename);
      }

      return null;
    },
  });

  return config;
};
