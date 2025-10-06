'use strict';

// tslint:disable:no-unused-expression
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

const { expect } = require('chai');
const sinon = require('sinon');
const RodretDevice = require('./rodretdevice.js');
const LightDevice = require('./lightdevice.js');

// The adapter exports a factory function:  module.exports = options => new IkeaRodret(options);
import createAdapter from './main.js'; // adjust path if necessary

describe('IkeaRodret Adapter', () => {
    let adapterMock;
    let sandbox;

    beforeEach(() => {
        sandbox = sinon.createSandbox();

        // Mock adapter class dependencies
        sandbox.stub(LightDevice.prototype, 'init').resolves();
        sandbox.stub(RodretDevice.prototype, 'init').resolves();
        sandbox.stub(RodretDevice.prototype, 'subscribe').resolves();
        sandbox.stub(RodretDevice.prototype, 'addLight');

        adapterMock = createAdapter({}); // no options needed for testing

        adapterMock.log = {
            info: sinon.stub(),
            warn: sinon.stub(),
            error: sinon.stub(),
            debug: sinon.stub(),
            silly: sinon.stub(),
        };
        adapterMock.getForeignObjectAsync = sinon.stub().resolves({ type: 'device', common: { type: 'E2201' } });
        adapterMock.getForeignObjectsAsync = sinon.stub().resolves({});
        adapterMock.subscribeForeignStatesAsync = sinon.stub().resolves();
    });

    afterEach(() => {
        sandbox.restore();
    });

    describe('constructor', () => {
        it('should initialize deviceMap as an empty Map', () => {
            expect(adapterMock.deviceMap).to.be.instanceof(Map);
            expect(adapterMock.deviceMap.size).to.equal(0);
        });
    });

    describe('onReady', () => {
        it('should log an error if no devices configured', async () => {
            adapterMock.config = { devices: [] };
            await adapterMock.onReady();
            expect(adapterMock.log.error.calledOnce).to.be.true;
            expect(adapterMock.deviceMap.size).to.equal(0);
        });

        it('should initialize one RODRET controlling multiple lights (1→n)', async () => {
            adapterMock.config = {
                devices: [
                    { rodretId: 'rodret.1', lightId: 'light.1' },
                    { rodretId: 'rodret.1', lightId: 'light.2' },
                ],
            };

            await adapterMock.onReady();

            // One RodretDevice expected
            expect(RodretDevice.prototype.init.calledOnce).to.be.true;
            expect(RodretDevice.prototype.addLight.calledTwice).to.be.true;

            expect(adapterMock.deviceMap.size).to.equal(1);
        });

        it('should initialize multiple RODRETs controlling one light (m→1)', async () => {
            adapterMock.config = {
                devices: [
                    { rodretId: 'rodret.1', lightId: 'light.1' },
                    { rodretId: 'rodret.2', lightId: 'light.1' },
                ],
            };

            await adapterMock.onReady();

            // Two RODRETs expected
            expect(RodretDevice.prototype.init.callCount).to.equal(2);
            expect(LightDevice.prototype.init.calledOnce).to.be.true;

            expect(adapterMock.deviceMap.size).to.equal(2);
        });

        it('should support n↔m mapping (multiple RODRETs controlling multiple lights)', async () => {
            adapterMock.config = {
                devices: [
                    { rodretId: 'rodret.1', lightId: 'light.1' },
                    { rodretId: 'rodret.1', lightId: 'light.2' },
                    { rodretId: 'rodret.2', lightId: 'light.2' },
                ],
            };

            await adapterMock.onReady();

            // Two RODRETs, two Lights, three mappings
            expect(RodretDevice.prototype.init.callCount).to.equal(2);
            expect(LightDevice.prototype.init.callCount).to.equal(2);
            expect(RodretDevice.prototype.addLight.callCount).to.equal(3);
            expect(adapterMock.deviceMap.size).to.equal(2);
        });

        it('should skip duplicate rodret-light mappings', async () => {
            adapterMock.config = {
                devices: [
                    { rodretId: 'rodret.1', lightId: 'light.1' },
                    { rodretId: 'rodret.1', lightId: 'light.1' }, // duplicate
                ],
            };

            await adapterMock.onReady();

            expect(RodretDevice.prototype.init.calledOnce).to.be.true;
            expect(LightDevice.prototype.init.calledOnce).to.be.true;
            expect(RodretDevice.prototype.addLight.calledOnce).to.be.true;

            expect(adapterMock.log.warn.calledWithMatch(/Duplicate mapping/)).to.be.true;
        });

        it('should skip invalid entries with missing IDs', async () => {
            adapterMock.config = {
                devices: [
                    { rodretId: '', lightId: 'light.1' },
                    { rodretId: 'rodret.1', lightId: '' },
                ],
            };

            await adapterMock.onReady();

            expect(adapterMock.deviceMap.size).to.equal(0);
            expect(adapterMock.log.warn.callCount).to.be.at.least(1);
        });
    });
});
