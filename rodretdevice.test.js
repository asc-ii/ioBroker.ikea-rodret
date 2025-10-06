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
            handleAction: sinon.stub().resolves(),
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
        const device = new RodretDevice(adapterMock, rodretId);
        device.lights = [lightMock]; // add mock light

        await device.handleAction('on');
        expect(lightMock.handleAction.calledWith('on', rodretId)).to.be.true;

        await device.handleAction('off');
        expect(lightMock.handleAction.calledWith('off', rodretId)).to.be.true;

        await device.handleAction('brightness_move_up');
        expect(lightMock.handleAction.calledWith('brightness_move_up', rodretId)).to.be.true;

        await device.handleAction('brightness_move_down');
        expect(lightMock.handleAction.calledWith('brightness_move_down', rodretId)).to.be.true;

        await device.handleAction('brightness_stop');
        expect(lightMock.handleAction.calledWith('brightness_stop', rodretId)).to.be.true;

        await device.handleAction('unknown_action');
        expect(lightMock.handleAction.calledWith('unknown_action', rodretId)).to.be.true;
    });
});
