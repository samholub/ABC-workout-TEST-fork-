# Renders every spoken cue to audio/<key>.mp3 with the Kokoro voice model.
# Run: node tools/phrases.js > /tmp/phrases.json && python3 tools/make-audio.py /tmp/phrases.json
# Needs: pip install kokoro-onnx soundfile; ffmpeg; kokoro-v1.0.onnx and voices-v1.0.bin
# from github.com/thewh1teagle/kokoro-onnx releases (model-files-v1.0) in $KOKORO_DIR.
import json, os, subprocess, sys
import soundfile as sf
from kokoro_onnx import Kokoro
VOICE = os.environ.get('VOICE', 'af_heart')
d = os.environ.get('KOKORO_DIR', '/tmp/tts')
k = Kokoro(os.path.join(d, 'kokoro.onnx'), os.path.join(d, 'voices.bin'))
phrases = json.load(open(sys.argv[1]))
out = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'audio')
os.makedirs(out, exist_ok=True)
for key, text in phrases.items():
    samples, sr = k.create(text, voice=VOICE, speed=1.0, lang='en-us')
    wav = '/tmp/_clip.wav'
    sf.write(wav, samples, sr)
    subprocess.run(['ffmpeg', '-loglevel', 'error', '-y', '-i', wav, '-af', 'silenceremove=start_periods=1:start_threshold=-50dB,areverse,silenceremove=start_periods=1:start_threshold=-50dB,areverse,loudnorm=I=-14:TP=-1',
                    '-ac', '1', '-ar', '24000', '-b:a', '40k', os.path.join(out, key + '.mp3')], check=True)
print(len(phrases), 'clips ->', out)
