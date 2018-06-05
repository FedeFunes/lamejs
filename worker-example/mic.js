/**
 * Created by intelWorx on 27/10/2015.
 */
(function (exports) {

  var MP3Recorder = function (config) {

    var recorder = this;
    var startTime = 0;
    var context = new AudioContext();
    var micStream;
    var realTimeWorker = new Worker('worker-realtime.js');
    var mp3ReceiveSuccess
    var currentErrorCallback;
    var microphone;
    var processor;

    config = config || {};

    // Initializes LAME so that we can record.
    this.initialize = function () {
      config.sampleRate = context.sampleRate;
      realTimeWorker.postMessage({ cmd: 'init', config: config });
    };
 
    // Function that handles getting audio out of the browser's media API.
    function beginRecording(stream) {
      // Set up Web Audio API to process data from the media stream (microphone).
      microphone = context.createMediaStreamSource(stream);
      // Settings a bufferSize of 0 instructs the browser to choose the best bufferSize
      processor = context.createScriptProcessor(0, 1, 1);
      // Add all buffers from LAME into an array.
      processor.onaudioprocess = function (event) {
        // Send microphone data to LAME for MP3 encoding while recording.
        var array = event.inputBuffer.getChannelData(0);
        // Encode input buffer.
        realTimeWorker.postMessage({ cmd: 'encode', buf: array })
      };

      // Begin retrieving microphone data.
      microphone.connect(processor);
      processor.connect(context.destination);
    }

    // Function for kicking off recording once the button is pressed.
    this.start = function (onSuccess, onError) {

      // Request access to the microphone.
      navigator.mediaDevices.getUserMedia({ audio: true }).then(function (stream) {

        micStream = stream;
        // Begin recording
        beginRecording(stream);
        recorder.startTime = Date.now();
        
        if (onSuccess && typeof onSuccess === 'function') {
          onSuccess();
        }      
      }, function (error) {
        if (onError && typeof onError === 'function') {
          onError(error);
        }
      });
    };

    // This function finalizes LAME output.
    this.stop = function () {
     
      if (processor && microphone) {
        // Clean up the Web Audio API resources.
        microphone.disconnect();
        processor.disconnect();
        processor.onaudioprocess = null;
        // Close mic.
        micStream.getAudioTracks()[0].stop()
      }
    };

    // Saves the MP3 data to a file.
    this.getMp3Blob = function (onSuccess, onError) {
      currentErrorCallback = onError;
      mp3ReceiveSuccess = onSuccess;
      realTimeWorker.postMessage({ cmd: 'finish' });
    };

    realTimeWorker.onmessage = function (e) {
      switch (e.data.cmd) {
        case 'end':
          if (mp3ReceiveSuccess) {
            mp3ReceiveSuccess(new Blob(e.data.buf, { type: 'audio/mp3' }));
          }
          console.log('MP3 data size', e.data.buf.length);
          break;
        case 'error':
          if (currentErrorCallback) {
            currentErrorCallback(e.data.error);
          }
          break;
        default:
          console.log('I just received a message I know not how to handle.', e.data);
      }
    };

    this.initialize();
  };

  exports.MP3Recorder = MP3Recorder;

})(window);
