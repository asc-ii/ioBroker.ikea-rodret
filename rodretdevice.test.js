'use strict';

const { expect } = require('chai');
const sinon = require('sinon');
const RodretDevice = require('./rodretdevice.js');

describe('RodretDevice', () => {
    let adapterMock, lightMock;

    beforeEach(() => {
        adapterMock = {
            log: {
                debug: sinon.spy(),
                info: sinon.spy(),
                warn: sinon.spy(),
            },
            getForeignObjectAsync: sinon.stub(),
            subscribeForeignStatesAsync: sinon.stub().resolves(),
        };

        lightMock = {
            _switch: sinon.stub().resolves(),
            _dimUp: sinon.stub().resolves(),
            _dimDown: sinon.stub().resolves(),
            _stopDim: sinon.stub().resolves(),
        };
    });

    it('should throw if adapter is missing', () => {
        expect(() => new RodretDevice(null, 'rodret.id', lightMock)).to.throw();
    });

    it('should throw if rodretId is invalid', () => {
        expect(() => new RodretDevice(adapterMock, '', lightMock)).to.throw();
    });

    it('should initialize and validate rodret correctly', async () => {
        const rodretId = 'zigbee.0.rodret1';
        const actionId = `${rodretId}.action`;
        adapterMock.getForeignObjectAsync.withArgs(rodretId).resolves({
            type: 'device',
            common: { type: 'E2201', name: 'RODRET Test' },
        });
        adapterMock.getForeignObjectAsync.withArgs(actionId).resolves({
            _id: actionId,
        });

        const device = new RodretDevice(adapterMock, rodretId, lightMock);
        await device.init();

        expect(device.name).to.equal('RODRET Test');
        expect(adapterMock.getForeignObjectAsync.calledWith(rodretId)).to.be.true;
        expect(adapterMock.getForeignObjectAsync.calledWith(actionId)).to.be.true;
    });

    it('should subscribe to action state', async () => {
        const device = new RodretDevice(adapterMock, 'zigbee.0.rodret2', lightMock);
        await device.subscribe();
        expect(adapterMock.subscribeForeignStatesAsync.called).to.be.true;
    });

    it('should delegate actions to light device', async () => {
        const rodretId = 'zigbee.0.rodret3';
        const device = new RodretDevice(adapterMock, rodretId, lightMock);

        await device.handleAction('on', rodretId);
        expect(lightMock._switch.calledWith(true)).to.be.true;

        await device.handleAction('off', rodretId);
        expect(lightMock._switch.calledWith(false)).to.be.true;

        await device.handleAction('brightness_up', rodretId);
        expect(lightMock._dimUp.called).to.be.true;

        await device.handleAction('brightness_down', rodretId);
        expect(lightMock._dimDown.called).to.be.true;

        await device.handleAction('brightness_stop', rodretId);
        expect(lightMock._stopDim.called).to.be.true;

        await device.handleAction('unknown_action', rodretId);
        expect(adapterMock.log.warn.called).to.be.true;
    });
});
