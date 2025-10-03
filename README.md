![Logo](docs/rodret_128.png)

# ioBroker.ikea-rodret

[![NPM version](https://img.shields.io/npm/v/iobroker.ikea-rodret.svg)](https://www.npmjs.com/package/iobroker.ikea-rodret)
[![Downloads](https://img.shields.io/npm/dm/iobroker.ikea-rodret.svg)](https://www.npmjs.com/package/iobroker.ikea-rodret)
![Number of Installations](https://iobroker.live/badges/ikea-rodret-installed.svg)
![Current version in stable repository](https://iobroker.live/badges/ikea-rodret-stable.svg)

[![NPM](https://nodei.co/npm/iobroker.ikea-rodret.png?downloads=true)](https://nodei.co/npm/iobroker.ikea-rodret/)

**Tests:** ![Test and Release](https://github.com/asc-ii/ioBroker.ikea-rodret/workflows/Test%20and%20Release/badge.svg)

## IKEA RODRET Dimmer (E2201) adapter for ioBroker

This adapter lets you use the IKEA RODRET wireless dimmer as a true dimmer for a selected light in ioBroker.
Normally, the RODRET only sends a single “action” event (e.g. `brightness_move_up`) when the button is pressed,
so you would have to create your own JavaScript to achieve continuous dimming.

With this adapter you simply configure a target light, and the adapter will
brighten or dim it smoothly while you hold the button — no extra scripting required.

## Changelog

<!--
	Placeholder for the next version (at the beginning of the line):
	### **WORK IN PROGRESS**
-->
### 0.0.6 (2025-10-02)

- (asc-ii) fix logging
- (asc-ii) fix translations
- (asc-ii) update adapter image

### 0.0.5 (2025-10-02)

- (asc-ii) feat: supporting multiple devices per adapter

### 0.0.4 (2025-09-23)

- (asc-ii) feat: add verbose logging option
- (asc-ii) fix: ignoring empty light state
- (asc-ii) update admin layout

### 0.0.3 (2025-09-23)

- (asc-ii) remove debug function
- (asc-ii) add status logs

### 0.0.2 (2025-09-22)

- (asc-ii) fix translations

### 0.0.1 (2025-09-22)

- (asc-ii) initial release

## License

MIT License

Copyright (c) 2025 Adrian Schyja <asc-ii@gmx.net>

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
