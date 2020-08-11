import "./stylesheets/main.css";

// Small helpers you might want to keep
import "./helpers/context_menu.js";
import "./helpers/external_links.js";

// ----------------------------------------------------------------------------
// Everything below is just to show you how it works. You can delete all of it.
// ----------------------------------------------------------------------------

import { remote } from "electron";
import jetpack from "fs-jetpack";

import * as adb from "./adb"

import {exec} from "child_process";

const app = remote.app;
const appDir = jetpack.cwd(app.getAppPath());

const devicesLabel = document.querySelector('.device-label');
const installLabel = document.querySelector('.install-label');
const adminLabel = document.querySelector('.admin-label');
const finishLabel = document.querySelector('.finish-label');

const installLoadingIndicator = document.querySelector('.install-loading')
const adminLoadingIndicator = document.querySelector('.admin-loading')
const finishLoadingIndicator = document.querySelector('.finish-loading')

let currentStep = 0;
let deviceId;
let deviceIds = [];
let appInstalled = false;
let appIsAdmin = false;

document.querySelector("#app").style.display = "block";
document.querySelector('button.scan-devices').addEventListener('click', event => {
  console.log('Scanning for devices via ADB')

  // noinspection DuplicatedCode
  adb.scanForDevices(devices => {
    console.log(`Devices:\n${JSON.stringify(devices)}`);

    // Set our state so that we know if we have devices
    deviceIds = devices.map(device => device.properties['transport_id']);

    // Update UI to reflect our found devices
    devicesLabel.style.color = 'green';
    devicesLabel.innerHTML = devices.map(device => {
      if (device.properties.model) {
        return `${device.properties.model} (ID: ${device.deviceId})`
      } else if (device.deviceId) {
        return `Unknown Device (ID: ${device.deviceId})`
      } else {
        return `Unknown Device (${JSON.stringify(device)})`
      }
    }).join('</br>');
    updateSteps();
  }, err => {
    devicesLabel.style.color = 'indianred';
    devicesLabel.innerHTML = `${err}`
  })
})

/**
 * Install the helper + app apk's on to all connected devices
 */
document.querySelector('button.install-app').addEventListener('click', event => {
  console.log('Installing application')
  if (deviceIds.length > 0) {
    installLoadingIndicator.style.display = "inline-block";

    const installPromises = deviceIds.map(deviceId => {
      return adb.installApk(deviceId, `${app.getAppPath().replace(/(\s+)/g, '\\$1')}/resources/apks/installer.apk`)
        .then(value => adb.installApk(deviceId, `${app.getAppPath().replace(/(\s+)/g, '\\$1')}/resources/apks/app-release.apk`))
    })

    Promise.all(installPromises)
      .then(results => {
        const success = results.filter(value => value).length;
        console.log(`APKs installed on ${success} of ${results.length} devices`);
        installLabel.style.color = 'green'
        installLabel.innerHTML = `APK installed on ${success} of ${results.length} devices`;

        appInstalled = true;
        updateSteps()
      })
      .catch(err => {
        installLabel.style.color = 'indianred'
        installLabel.innerHTML = `Installs Failed:\n${err}`
      })
      .finally(() => {
        installLoadingIndicator.style.display = "none";
      })
  }
})

/**
 * Admin setup
 */
document.querySelector('button.set-admin').addEventListener('click', event => {
  console.log('Setting app as device admin');
  if (deviceIds.length > 0) {
    adminLoadingIndicator.style.display = "inline-block";

    const adminPromises = deviceIds.map(deviceId => {
      return adb.setAsActiveAdmin(deviceId, 'com.scdew.installer/.AppDeviceAdminReceiver')
        .then(value => {
          return adb.setAsDeviceOwner(deviceId, 'com.scdew.installer/.AppDeviceAdminReceiver')
            .catch(reason => reason)
        })
    })

    Promise.all(adminPromises)
      .then(results => {
        adminLabel.style.color = 'green';
        adminLabel.innerHTML = `App set as a device admin`
        appIsAdmin = true;
        updateSteps()
      })
      .catch(err => {
        adminLabel.style.color = 'indianred';
        adminLabel.innerHTML = `Admin Setup Failed: \n${err}`
      })
      .finally(() => {
        adminLoadingIndicator.style.display = "none";
      })
  }
});

/**
 * Finish button
 */
document.querySelector('button.finish-setup').addEventListener('click', event => {
  console.log('Finish setting up app')
  if (deviceIds.length > 0) {
    finishLoadingIndicator.style.display = "block";

    const finishPromises = deviceIds.map(deviceId => {
      return adb.startWorkforceApp(deviceId)
        .then(value => adb.disableUsbDebugging(deviceId))
    })

    Promise.all(finishPromises)
      .then(results => {
        finishLabel.style.color = "green";
        finishLabel.innerHTML = `Setup Finished! You can unplug the device now!`;
      })
      .catch(err => {
        finishLabel.style.color = "indianred";
        finishLabel.innerHTML = "Something went wrong when finishing the setup, if this happens just press home on the device and set the workforce app to open as always for the home app"
      })
      .finally(() => {
        finishLoadingIndicator.style.display = "none";
      })
  }
})

// noinspection DuplicatedCode
function updateSteps() {
  if (deviceIds.length > 0) currentStep = 1;
  if (appInstalled) currentStep = 2;
  if (appIsAdmin) currentStep = 3;

  for (let i = 0; i < 4; i++) {
    if (i <= currentStep) {
      document.querySelector(`div.step${i}`).style.display = "block";
    } else {
      document.querySelector(`div.step${i}`).style.display = "none";
    }
  }
}
