'use strict';

/**
 * This is a dummy TypeScript test file using chai and mocha
 *
 * It's automatically excluded from npm and its build output is excluded from both git and npm.
 * It is advised to test all your modules with accompanying *.test.js-files
 */

// tslint:disable:no-unused-expression

const { expect } = require('chai');
const LightDevice = require('./lightdevice');
const sinon = require("sinon");

describe("LightDevice", () => {
    let adapterMock;

    beforeEach(() => {
        adapterMock = {
            log: {
                warn: sinon.spy(),
                info: sinon.spy(),
                error: sinon.spy(),
                debug: sinon.spy(),
                silly: sinon.spy(),
            },
            getForeignObjectAsync: sinon.stub(),
            getForeignObjectsAsync: sinon.stub(),
        };
    });

    afterEach(() => {
        sinon.restore();
    });

    describe("constructor", () => {
        it("should throw if no config is provided", () => {
            expect(() => new LightDevice(adapterMock, null)).to.throw();
        });

        it("should throw if no lightId is provided", () => {
            expect(() => new LightDevice(adapterMock, {})).to.throw();
        });
    });

    describe("init", () => {
        it("should discover switch, brightness_move, transition_time, and level states", async () => {
            // fake light root with child states
            const lightObject = {
                _id: "zigbee.0.light1",
                type: "device",
            };

            const states = {
                "zigbee.0.light1.on": { common: { role: "switch" } },
                "zigbee.0.light1.brightness_move": { common: { name: "brightness_move" } },
                "zigbee.0.light1.transition_time": { common: { name: "transition_time" } },
                "zigbee.0.light1.level": { common: { role: "level.dimmer" } },
            };

            adapterMock.getForeignObjectAsync.callsFake(async (id) => {
                if (id === "zigbee.0.light1") return lightObject;
                return states[id];
            });

            adapterMock.getForeignObjectsAsync.callsFake(async (id) => {
                return states;
            });

            const device = new LightDevice(adapterMock, "zigbee.0.light1");
            await device.init();

            expect(device.switchId).to.equal("zigbee.0.light1.on");
            expect(device.brightnessMoveId).to.equal("zigbee.0.light1.brightness_move");
            expect(device.levelId).to.equal("zigbee.0.light1.level");
        });

        it("should log a warning if brightness_move is missing", async () => {
            const lightObject = {
                _id: "zigbee.0.light2",
                type: "device",
            };

            const states = {
                "zigbee.0.light2.on": { common: { role: "switch" } },
                "zigbee.0.light2.level": { common: { role: "level.dimmer" } },
            };

            adapterMock.getForeignObjectAsync.callsFake(async (id) => {
                if (id === "zigbee.0.light2") return lightObject;
                return states[id];
            });
            adapterMock.getForeignObjectsAsync.callsFake(async (id) => {
                return states;
            });

            const device = new LightDevice(adapterMock, "zigbee.0.light2");
            await device.init();

            expect(adapterMock.log.warn.called).to.be.true;
            expect(device.brightnessMoveId).to.be.null;
        });

        it("should throw if no switch state is found", async () => {
            const lightObject = {
                _id: "zigbee.0.light4",
                type: "device",
            };

            const states = {
                "zigbee.0.light4.level": { common: { role: "level.dimmer" } },
            };

            adapterMock.getForeignObjectAsync.callsFake(async (id) => {
                if (id === "zigbee.0.light4") return lightObject;
                return states[id];
            });
            adapterMock.getForeignObjectsAsync.callsFake(async (id) => {
                return states;
            });

            const device = new LightDevice(adapterMock, "zigbee.0.light4");

            try {
                await device.init();
                throw new Error("Expected error but did not throw");
            } catch (err) {
				console.error(err.message);
                expect(err.message).to.match(/Light zigbee.0.light4 has no switch state/);
            }
        });
    });
});
