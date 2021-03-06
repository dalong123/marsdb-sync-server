import MethodCallManager, { _cleanMethods } from '../../lib/MethodCallManager';
import { createCollectionManager, _registerCollection,
  _clearRegisteredCollections } from '../../lib/CollectionManager';
import { Collection, Random } from 'marsdb';
import chai, {expect} from 'chai';
import sinon from 'sinon';
chai.use(require('chai-as-promised'));
chai.use(require('sinon-chai'));
chai.should();


describe('CollectionManager', function () {
  beforeEach(function () {
    _clearRegisteredCollections();
    _cleanMethods();
  });

  describe('#_registerCollection', function () {
    it('should register a collection and rise an exception on duplicate', function () {
      const coll = new Collection('test').storage;
      (() => new Collection('test').storage).should.throw(Error);
    });
  });

  describe('#_remoteInsert', function () {
    it('should insert a document on remote message and return promise', function () {
      const connMock = {
        on: sinon.spy(),
        emit: sinon.spy(),
        sendResult: sinon.spy(),
        sendUpdated: sinon.spy(),
        subManager: { whenAllCursorsUpdated: () => Promise.resolve() },
      };
      const coll = new Collection('test');
      const manager = new MethodCallManager(connMock);
      const handler = connMock.on.getCall(0).args[1];
      coll._lazyInitCollection();
      return handler({
        method: '/test/insert',
        params: [{a: 1}]
      }).then((docId) => {
        docId.should.be.a('string');
        return coll.findOne({a: 1});
      }).then((doc) => {
        doc.a.should.be.equal(1);
      });
    });

    it('should handle accepted remote insert', function () {
      const connMock = {
        on: sinon.spy(),
        sendResult: sinon.spy(),
        sendUpdated: sinon.spy(),
        subManager: {
          whenAllCursorsUpdated: () => Promise.resolve(),
          _handleAcceptedRemoteInsert: sinon.spy(),
        },
      };
      const seed = Random.default().id(20);
      const sequenceSeed = [seed, `/collection/test`];
      const seededID = Random.createWithSeeds.apply(null, sequenceSeed).id(17);
      const coll = new Collection('test');
      const manager = new MethodCallManager(connMock);
      const handler = connMock.on.getCall(0).args[1];
      coll._lazyInitCollection();
      return handler({
        method: '/test/insert',
        params: [{a: 1, _id: seededID}],
        randomSeed: seed,
      }).then((docId) => {
        connMock.subManager._handleAcceptedRemoteInsert.should.have.callCount(1);
        connMock.subManager._handleAcceptedRemoteInsert.getCall(0)
          .args[0].should.be.deep.equal({a: 1, _id: seededID});
        connMock.subManager._handleAcceptedRemoteInsert.getCall(0)
          .args[1].should.be.deep.equal('test');
      });
    });

    it('should return added if options.waitReady provided and id is valid', function () {
      const connMock = {
        on: sinon.spy(),
        sendResult: sinon.spy(),
        sendUpdated: sinon.spy(),
        subManager: {
          whenAllCursorsUpdated: () => Promise.resolve(),
          _handleAcceptedRemoteInsert: sinon.spy(),
        },
      };
      const seed = Random.default().id(20);
      const sequenceSeed = [seed, `/collection/test`];
      const seededID = Random.createWithSeeds.apply(null, sequenceSeed).id(17);
      const coll = new Collection('test');
      const manager = new MethodCallManager(connMock);
      const handler = connMock.on.getCall(0).args[1];
      coll._lazyInitCollection();
      return handler({
        method: '/test/insert',
        params: [{a: 1, _id: seededID}, {waitReady: true}],
        randomSeed: seed,
      }).then((docId) => {
        connMock.subManager._handleAcceptedRemoteInsert.should.have.callCount(0);
      });
    });
  });

  describe('#_remoteUpdate', function () {
    it('should update a document on remote message and return promise', function () {
      const connMock = {
        on: sinon.spy(),
        sendResult: sinon.spy(),
        sendUpdated: sinon.spy(),
        subManager: { whenAllCursorsUpdated: () => Promise.resolve() },
      };
      const coll = new Collection('test');
      const manager = new MethodCallManager(connMock);
      const handler = connMock.on.getCall(0).args[1];

      return coll.insert({a: 1}).then(() => {
        return handler({
          method: '/test/update',
          params: [{a: 1}, {$set: {a: 2}}]
        });
      }).then((res) => {
        return Promise.all([
          coll.findOne({a: 1}),
          coll.findOne({a: 2}),
        ]);
      }).then((res) => {
        expect(res[0]).to.be.undefined;
        res[1].a.should.be.equal(2);
      });
    });

    it('should accpet options for upserting and muktiple updates', function () {
      const connMock = {
        on: sinon.spy(),
        sendResult: sinon.spy(),
        sendUpdated: sinon.spy(),
        subManager: { whenAllCursorsUpdated: () => Promise.resolve() },
      };
      const coll = new Collection('test');
      const manager = new MethodCallManager(connMock);
      const handler = connMock.on.getCall(0).args[1];

      return coll.insertAll([{a: 1}, {a: 2}]).then(() => {
        return handler({
          method: '/test/update',
          params: [{}, {$set: {a: 3}}, {multi: true}]
        });
      }).then((res) => {
        return coll.find();
      }).then((res) => {
        res.should.have.length(2);
        res[0].a.should.be.equal(3);
        res[1].a.should.be.equal(3);
      });
    });
  });

  describe('#_remoteRemove', function () {
    it('should remove a document on remote message and return promise', function () {
      const connMock = {
        on: sinon.spy(),
        sendResult: sinon.spy(),
        sendUpdated: sinon.spy(),
        subManager: { whenAllCursorsUpdated: () => Promise.resolve() },
      };
      const coll = new Collection('test');
      const manager = new MethodCallManager(connMock);
      const handler = connMock.on.getCall(0).args[1];

      return coll.insert({a: 1}).then(() => {
        return handler({
          method: '/test/remove',
          params: [{a: 1}]
        });
      }).then((res) => {
        return coll.findOne({a: 1});
      }).then((res) => {
        expect(res).to.be.undefined;
      });
    });

    it('should accept options for multiple removing', function () {
      const connMock = {
        on: sinon.spy(),
        sendResult: sinon.spy(),
        sendUpdated: sinon.spy(),
        subManager: { whenAllCursorsUpdated: () => Promise.resolve() },
      };
      const coll = new Collection('test');
      const manager = new MethodCallManager(connMock);
      const handler = connMock.on.getCall(0).args[1];

      return coll.insertAll([{a: 1}, {a: 2}]).then(() => {
        return handler({
          method: '/test/remove',
          params: [{}, {multi: true}]
        });
      }).then((res) => {
        return coll.find({});
      }).then((res) => {
        res.should.have.length(0);
      });
    });
  });

  describe('#_removeSync', function () {
    it('should return a list of removed ids in db', function () {
      const connMock = {
        on: sinon.spy(),
        sendResult: sinon.spy(),
        sendUpdated: sinon.spy(),
        subManager: { whenAllCursorsUpdated: () => Promise.resolve() },
      };
      const coll = new Collection('test');
      const manager = new MethodCallManager(connMock);
      const handler = connMock.on.getCall(0).args[1];

      return coll.insertAll([{_id: 1}, {_id: 2}]).then(() => {
        return handler({
          method: '/test/sync',
          params: [[1,2,3]]
        });
      }).then((res) => {
        res.should.be.deep.equal([3]);
      })
    });
  });

  describe('#_ensureDocumentId', function () {
    it('should ignore ensuring if no id or no seed provided', function () {
      const connMock = { sendRemoved: sinon.spy() };
      const coll = new Collection('test');
      const doc = {a: 1};
      coll._lazyInitCollection();
      coll.delegate._ensureDocumentId(doc);
      expect(doc._id).to.be.undefined;
      connMock.sendRemoved.should.have.callCount(0);
    });

    it('should remove id if no randomSeed provided', function () {
      const connMock = { sendRemoved: sinon.spy() };
      const coll = new Collection('test');
      coll._lazyInitCollection();
      const testIt = (randomSeed) => {
        let doc = {a: 1, _id: '1'};
        coll.delegate._ensureDocumentId(doc, connMock, randomSeed);
        expect(doc._id).to.be.undefined;
      };

      testIt('');
      testIt('13');
      testIt(1234);
      testIt({});
      testIt(new Date());
      testIt('hfkgjhsdlkfhjgslkdjhgsljhlakhdflakdjsf');
      testIt(Random.default().id(20));
    });

    it('should accept id if generated id is equal', function () {
      const seed = Random.default().id(20);
      const sequenceSeed = [seed, `/collection/test`];
      const seededID = Random.createWithSeeds.apply(null, sequenceSeed).id(17);
      const connMock = { sendRemoved: sinon.spy() };
      const coll = new Collection('test');
      coll._lazyInitCollection();
      const doc = {a: 1, _id: seededID};
      coll.delegate._ensureDocumentId(doc, connMock, seed);
      expect(doc._id).to.be.equal(seededID);
      connMock.sendRemoved.should.have.callCount(0);
    });
  });
});
