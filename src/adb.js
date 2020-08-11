import { exec } from "child_process";
import {remote} from "electron";
import os from "os";

const app = remote.app;
const adbDeviceRegex = /^\S+(?=\s+(?:device))/;
const adbDevicePropRegex = /\w+:\w+/g;

/**
 * Scan for devices using adb
 *
 * @param callback the success callback. Returns list of device objects { deviceId: id, properties: Object }
 * @param error the error callback. Get's called if there is an issue
 */
export function scanForDevices(callback, error) {
  // noinspection DuplicatedCode
  const devicesCallback = function(output) {
    let deviceIds = [];
    const lines = output.split('\n');
    lines.forEach(line => {
      const id = adbDeviceRegex.exec(line);
      if (id && id.length === 1) {
        const props = [...line.matchAll(adbDevicePropRegex)];
        console.log(`Props: ${props}`);
        let properties = {};
        if (props) {
          props.map(value => value.toString().split(':'))
            .forEach(prop => properties[prop[0]] = prop[1])
        }

        deviceIds.push(
          {
            deviceId: id[0],
            properties: properties
          }
        )
      }
    })

    callback(deviceIds)
  }

  adb('devices -l', null, devicesCallback, error)
}

export function installApk(transportId, apkFilePath) {
  const cmd = `install -r -g -d ${apkFilePath}`;
  return adbAsync(cmd, transportId)
}

export function setAsActiveAdmin(transportId, component) {
  const cmd = `shell dpm set-active-admin --user current ${component}`;
  return adbAsync(cmd, transportId)
}

export function setAsDeviceOwner(transportId, component) {
  const cmd = `shell dpm set-device-owner --user current ${component}`;
  return adbAsync(cmd, transportId)
}

export function setAsProfileOwner(transportId, component) {
  const cmd = `shell dpm set-profile-owner --user current ${component}`;
  return adbAsync(cmd, transportId)
}

export function startWorkforceApp(transportId) {
  const cmd = `shell am start -S -n com.scdew.workforce/.ui.MainActivity`;
  return adbAsync(cmd, transportId)
}

export function disableUsbDebugging(transportId) {
  const cmd = `shell settings put global adb_enabled 0`;
  return adbAsync(cmd, transportId)
}

function adbAsync(command, transportId) {
  return new Promise(((resolve, reject) => {
    const successCallback = function (output) {
      console.log(output)
      resolve(output)
    }

    const errorCallback = function (err) {
      if (err) {
        reject(err)
      }
    }

    adb(command, transportId, successCallback, errorCallback)
  }))
}

function adb(command, transportId, callback, error) {
  const adbCmd = getAdbCommand();
  const cmd = `${adbCmd} ${transportId ? `-t ${transportId}` : ''} ${command}`;
  console.log(`Executing: "${cmd}"`)
  exec(cmd, ((error1, stdout, stderr) => {
    console.log(`adb output: ${stdout}`)
    if (error1) {
      console.log(`adb error(${error1})`)
      error(error1)
    } else if (stderr) {
      console.log(`adb std error(${stderr})`)
      error(stderr)
    } else {
      callback(stdout)
    }
  }))
}

function getAdbCommand() {
  if (os.platform() === 'darwin') {
    return `${app.getAppPath().replace(/(\s+)/g, '\\$1')}/resources/adb/mac/adb`
  } else if (os.platform() === 'win32') {
    return `${app.getAppPath().replace(/(\s+)/g, '\\$1')}/resources/adb/win/adb.exe`
  } else {
    throw 'Unsupported Platform'
  }
}
