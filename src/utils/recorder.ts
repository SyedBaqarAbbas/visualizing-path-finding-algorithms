export class CanvasVideoRecorder {
  private mediaRecorder: MediaRecorder | null = null;
  private recordedChunks: Blob[] = [];
  private isRecording: boolean = false;

  public startRecording(canvas: HTMLCanvasElement, fps: number = 60): boolean {
    if (this.isRecording) return false;

    try {
      const stream = canvas.captureStream(fps);
      
      // Try vp9 or fallback to webm / mp4
      let options: MediaRecorderOptions = { mimeType: 'video/webm;codecs=vp9' };
      if (!MediaRecorder.isTypeSupported(options.mimeType!)) {
        options = { mimeType: 'video/webm' };
      }

      this.recordedChunks = [];
      this.mediaRecorder = new MediaRecorder(stream, options);

      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          this.recordedChunks.push(event.data);
        }
      };

      this.mediaRecorder.onstop = () => {
        const blob = new Blob(this.recordedChunks, { type: this.mediaRecorder?.mimeType || 'video/webm' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `berlin-pathfinding-${Date.now()}.webm`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      };

      this.mediaRecorder.start(100);
      this.isRecording = true;
      return true;
    } catch (err) {
      console.error('Failed to start canvas MediaRecorder:', err);
      return false;
    }
  }

  public stopRecording() {
    if (this.mediaRecorder && this.isRecording) {
      this.mediaRecorder.stop();
      this.isRecording = false;
    }
  }

  public get recordingState(): boolean {
    return this.isRecording;
  }
}
