'use strict';

const { expect } = require('chai');
const sinon = require('sinon');
const LightDevice = require('./lightdevice.js');

describe('LightDevice', () => {
    let adapterMock;

    beforeEach(() => {
        adapterMock = {
            log: {
                debug: sinon.spy(),
                warn: sinon.spy(),
                silly: sinon.spy(),
            },
            getForeignObjectAsync: sinon.stub(),
            getForeignObjectsAsync: sinon.stub(),
            getForeignStateAsync: sinon.stub(),
            setForeignStateAsync: sinon.stub(),
        };
    });

    describe('constructor', () => {
        it('should throw if adapter is missing', () => {
            expect(() => new LightDevice(null, 'light.id')).to.throw();
        });

        it('should throw if lightId is invalid', () => {
            expect(() => new LightDevice(adapterMock, '')).to.throw();
        });
    });

    describe('init', () => {
        it('should initialize correctly with all expected states', async () => {
            const lightId = 'zigbee.0.light1';

            // fake light root with child states
            const lightObject = {
                _id: lightId,
                type: 'device',
            };

            adapterMock.getForeignObjectAsync.withArgs(lightId).resolves(lightObject);
            adapterMock.getForeignObjectsAsync.resolves({
                [`${lightId}.switch`]: { common: { role: 'switch' } },
                [`${lightId}.brightness_move`]: { common: { min: -70, max: 70 } },
                [`${lightId}.level`]: { common: { role: 'level.dimmer' } },
            });

            const light = new LightDevice(adapterMock, lightId);
            await light.init();

            expect(light.switchId).to.equal(`${lightId}.switch`);
            expect(light.brightnessMoveId).to.equal(`${lightId}.brightness_move`);
            expect(light.levelId).to.equal(`${lightId}.level`);
            expect(light.minMoveSpeed).to.equal(-70);
            expect(light.maxMoveSpeed).to.equal(70);
        });

        it('should throw if no switch state is found', async () => {
            const lightObject = {
                _id: 'zigbee.0.light4',
                type: 'device',
            };

            const states = {
                'zigbee.0.light4.level': { common: { role: 'level.dimmer' } },
            };

            adapterMock.getForeignObjectAsync.callsFake(async id => {
                if (id === 'zigbee.0.light4') return lightObject;
                return states[id];
            });
            adapterMock.getForeignObjectsAsync.callsFake(async id => {
                return states;
            });

            const device = new LightDevice(adapterMock, 'zigbee.0.light4');

            try {
                await device.init();
                throw new Error('Expected error but did not throw');
            } catch (err) {
                expect(err.message).to.match(/Light zigbee.0.light4 has no switch state/);
            }
        });

        it('should read min and max move speeds from brightness_move', async () => {
            const lightObject = { _id: 'zigbee.0.light5', type: 'device' };

            const states = {
                'zigbee.0.light5.on': { common: { role: 'switch' } },
                'zigbee.0.light5.brightness_move': { common: { name: 'brightness_move', min: -30, max: 70 } },
                'zigbee.0.light5.level': { common: { role: 'level.dimmer' } },
            };

            adapterMock.getForeignObjectAsync.callsFake(async id => {
                if (id === 'zigbee.0.light5') return lightObject;
                return states[id];
            });
            adapterMock.getForeignObjectsAsync.callsFake(async id => {
                return states;
            });

            const device = new LightDevice(adapterMock, 'zigbee.0.light5');
            await device.init();

            expect(device.brightnessMoveId).to.equal('zigbee.0.light5.brightness_move');
            expect(device.minMoveSpeed).to.equal(-30);
            expect(device.maxMoveSpeed).to.equal(70);
        });

        it('should fallback to defaults if brightness_move has no min/max', async () => {
            const lightObject = { _id: 'zigbee.0.light6', type: 'device' };

            const states = {
                'zigbee.0.light6.on': { common: { role: 'switch' } },
                'zigbee.0.light6.brightness_move': { common: { name: 'brightness_move' } }, // no min/max
                'zigbee.0.light6.level': { common: { role: 'level.dimmer' } },
            };

            adapterMock.getForeignObjectAsync.callsFake(async id => {
                if (id === 'zigbee.0.light6') return lightObject;
                return states[id];
            });
            adapterMock.getForeignObjectsAsync.callsFake(async id => {
                return states;
            });

            const device = new LightDevice(adapterMock, 'zigbee.0.light6');
            await device.init();

            expect(device.minMoveSpeed).to.equal(-50); // default
            expect(device.maxMoveSpeed).to.equal(50); // default
        });

        it('should warn if brightness_move missing', async () => {
            const lightId = 'zigbee.0.light2';

            // fake light root with child states
            const lightObject = {
                _id: lightId,
                type: 'device',
            };

            adapterMock.getForeignObjectAsync.withArgs(lightId).resolves(lightObject);
            adapterMock.getForeignObjectsAsync.resolves({
                [`${lightId}.switch`]: { common: { role: 'switch' } },
            });

            const light = new LightDevice(adapterMock, lightId);
            await light.init();

            expect(adapterMock.log.warn.called).to.be.true;
            expect(light.brightnessMoveId).to.be.null;
        });
    });

    it('should switch light on and off', async () => {
        const light = new LightDevice(adapterMock, 'zigbee.0.light3');
        light.switchId = 'zigbee.0.light3.switch';

        await light._switch(true);
        expect(adapterMock.setForeignStateAsync.calledWith(light.switchId, { val: true })).to.be.true;
        await light._switch(false);
        expect(adapterMock.setForeignStateAsync.calledWith(light.switchId, { val: false })).to.be.true;
    });

    it('should start dim up and down', async () => {
        const light = new LightDevice(adapterMock, 'zigbee.0.light4');
        light.switchId = 'zigbee.0.light4.switch';
        light.brightnessMoveId = 'zigbee.0.light4.brightness_move';
        light.levelId = 'zigbee.0.light4.level';
        light.maxMoveSpeed = 60;
        light.minMoveSpeed = -60;

        adapterMock.getForeignStateAsync.withArgs(light.switchId).resolves({ val: false });
        adapterMock.getForeignStateAsync.withArgs(light.levelId).resolves({ val: 50 });

        await light._dimUp();
        expect(adapterMock.setForeignStateAsync.calledWith(light.switchId, { val: true })).to.be.true;
        expect(adapterMock.setForeignStateAsync.calledWith(light.brightnessMoveId, { val: 60 })).to.be.true;

        await light._dimDown();
        expect(adapterMock.setForeignStateAsync.calledWith(light.brightnessMoveId, { val: -60 })).to.be.true;
    });
});
