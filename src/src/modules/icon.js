import _          from 'lodash';
import Config     from './config';
import Prefix     from "./prefix";
import FileSystem from './file-system';
import System     from './system';

export default class Icon {

  /**
   * @type {string|null}
   */
  home = null;

  /**
   * @type {string|null}
   */
  desktop = null;

  /**
   * @type {string|null}
   */
  local = null;

  /**
   * @type {string|null}
   */
  title = null;

  /**
   * @type {string|null}
   */
  code = null;

  /**
   * @type {string[]|null}
   */
  folders = null;

  /**
   * @type {Config}
   */
  config = null;

  /**
   * @type {Prefix}
   */
  prefix = null;

  /**
   * @type {FileSystem}
   */
  fs = null;

  /**
   * @type {System}
   */
  system = null;

  /**
   * @param {Config} config
   * @param {Prefix} prefix
   * @param {FileSystem} fs
   * @param {System} system
   */
  constructor(config, prefix, fs, system) {
    this.config  = config;
    this.prefix  = prefix;
    this.fs      = fs;
    this.system  = system;
    this.home    = this.system.getHomeDir();
    this.desktop = this.system.getDesktopDir();
    this.local   = `${this.home}/.local/share/applications`;
    this.title   = this.config.getGameName();
    this.code    = this.config.getCode();
    this.folders = [
      '/Рабочий стол/Games',
      '/Рабочий стол/games',
      '/Рабочий стол/Игры',
      '/Рабочий стол/игры',
      '/Рабочий стол',
      '/Desktop/Игры',
      '/Desktop/игры',
      '/Desktop/Games',
      '/Desktop/games',
      '/Desktop',
    ].map(path => this.home + path);

    if (this.desktop) {
      this.folders = _.uniq([
        `${this.desktop}/Games`,
        `${this.desktop}/games`,
        `${this.desktop}/Игры`,
        `${this.desktop}/игры`,
        this.desktop,
      ].concat(this.folders));
    }
  }

  /**
   * @param {string} png
   * @param {string|null} autostart
   * @return {string}
   */
  getTemplate(png, autostart = null) {
    let binDir  = this.prefix.getBinDir();
    let startBy = null === autostart ? '' : ` --autostart ${autostart}`;

    return `[Desktop Entry]
Version=1.0
Exec="${binDir}/start" --game ${this.code}${startBy}
Path=${binDir}
Icon=${png}
Name=${this.title}
Terminal=false
TerminalOptions=
Type=Application
Categories=Game`;
  }

  /**
   * @return {string|null}
   */
  findIconsDir() {
    let path = this.folders.find((path) => this.fs.exists(path) && this.fs.isDirectory(path));

    if (!path) {
      return null;
    }

    return path;
  }

  /**
   * @return {string|null}
   */
  findApplicationsDir() {
    if (!this.fs.exists(this.local)) {
      return null;
    }

    return this.local;
  }

  /**
   * @return {string|null}
   */
  getIcon() {
    let path = this.config.getGameIcon();

    if (!path) {
      return null;
    }

    return path;
  }

  /**
   * @return {string[]}
   */
  findIcons() {
    let result = [];

    [ this.local ].concat(this.folders).forEach((path) => {
      let v1 = `${path}/${this.title}`;
      let v2 = `${v1}.desktop`;

      if (this.fs.exists(v1) && !this.fs.isDirectory(v1)) {
        result.push(v1);
      }
      if (this.fs.exists(v2) && !this.fs.isDirectory(v2)) {
        result.push(v2);
      }
    });

    return result;
  }

  remove() {
    this.findIcons().forEach(path => this.fs.rm(path));
  }

  /**
   * @param {boolean} menu
   * @param {boolean} desktop
   * @param {string|null} autostart
   * @return {boolean}
   */
  create(menu = true, desktop = true, autostart = null) {
    let png = this.getIcon();

    if (!png) {
      return false;
    }

    let result   = false;
    let template = this.getTemplate(png, autostart);
    let appsDir  = this.findApplicationsDir();
    let iconsDir = this.findIconsDir();

    if (appsDir && menu) {
      result   = true;
      let file = `${appsDir}/${this.title}.desktop`;
      this.fs.filePutContents(file, template);
      this.fs.chmod(file);
    }
    if (iconsDir && desktop) {
      result   = true;
      let file = `${iconsDir}/${this.title}.desktop`;
      this.fs.filePutContents(file, template);
      this.fs.chmod(file);
    }

    return result;
  }

  /**
   * @return {boolean}
   */
  extract() {
    let exeFile = this.config.getGameFullPath() + '/' + this.config.getGameExe();
    let iconDir = this.config.getImagesPath();
    let pngIcon = `${iconDir}/icon.png`;
    let icoFile = `${iconDir}/icon.ico`;

    if (!this.system.existsCommand('wrestool') || !this.fs.exists(exeFile) || this.config.getGameIcon()) {
      return false;
    }

    if (!this.fs.exists(iconDir)) {
      this.fs.mkdir(iconDir);
    }

    this.system.command.exec(`wrestool -x -t 14 "${exeFile}" > "${icoFile}"`);

    if (!this.fs.exists(icoFile)) {
      return false;
    }

    /**
     * @param {string} line
     * @param {string} field
     * @return {number}
     */
    const getValue = (line, field) => {
      return parseInt(line.split(`--${field}=`)[1].split(' ')[0]);
    };

    let ico = null;

    this.system.command.exec(`icotool -l "${icoFile}"`).split("\n").forEach((line) => {
      let icoTmp = {
        'index':     getValue(line, 'index'),
        'width':     getValue(line, 'width'),
        'bit-depth': getValue(line, 'bit-depth'),
      };

      if (!ico) {
        ico = icoTmp;
      } else if (ico['width'] < icoTmp['width'] || (ico['width'] === icoTmp['width'] && ico['bit-depth'] < icoTmp['bit-depth'])) {
        ico = icoTmp;
      }
    });

    if (!ico) {
      return false;
    }

    this.system.command.exec(`icotool -x --index=${ico['index']} "${icoFile}" -o "${pngIcon}"`);

    return this.fs.exists(pngIcon);
  }
}