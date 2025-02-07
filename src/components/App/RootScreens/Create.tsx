import React, { useState, useRef, DragEvent, ChangeEvent } from 'react';
import { Camera } from 'lucide-react';
import { firebaseStorageService, VideoType } from '../../../api/firebase/storage/service';

const Create: React.FC = () => {
  const [isDragOver, setIsDragOver] = useState(false);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoPreview, setVideoPreview] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  
  // New state for additional fields
  const [exerciseName, setExerciseName] = useState('');
  const [exerciseCategory, setExerciseCategory] = useState('Weight Training');
  const [tags, setTags] = useState<string[]>([]);
  const [caption, setCaption] = useState('');
  const [newTag, setNewTag] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  const categories = [
    'Weight Training', 
    'Cardio', 
    'Mobility', 
    'Stretching', 
    'Bodyweight'
  ];

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
    
    const files = e.dataTransfer.files;
    handleFileSelection(files[0]);
  };

  const handleFileInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileSelection(file);
    }
  };

  const handleFileSelection = (file: File) => {
    // Validate file type
    const ALLOWED_TYPES = ['video/mp4', 'video/quicktime', 'video/x-msvideo'];
    if (!ALLOWED_TYPES.includes(file.type)) {
      alert('Please upload a valid video file (MP4, AVI, QuickTime)');
      return;
    }

    // Create video preview
    const objectUrl = URL.createObjectURL(file);
    setVideoPreview(objectUrl);
    setVideoFile(file);
  };

  const handleAddTag = () => {
    if (newTag.trim() && !tags.includes(newTag.trim())) {
      setTags([...tags, newTag.trim()]);
      setNewTag('');
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter(tag => tag !== tagToRemove));
  };

  const handleSubmit = async () => {
    if (!videoFile) return;

    try {
      setIsUploading(true);
      const uploadResult = await firebaseStorageService.uploadVideo(
        videoFile, 
        VideoType.Exercise
      );

      // Here you would typically:
      // 1. Create an Exercise object
      // 2. Create an ExerciseVideo object
      // 3. Upload to Firestore
      console.log('Video uploaded successfully', uploadResult);
      console.log('Exercise Details:', {
        name: exerciseName,
        category: exerciseCategory,
        tags,
        caption
      });
    } catch (error) {
      console.error('Upload failed', error);
      alert('Video upload failed');
    } finally {
      setIsUploading(false);
    }
  };

  const clearVideo = () => {
    setVideoFile(null);
    setVideoPreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="max-w-xl mx-auto px-4 py-6">
      <div className="text-center text-white mb-6">
        <h2 className="text-2xl font-bold">Create</h2>
        <p className="text-zinc-400">Start building your next workout or post.</p>
      </div>

      <div 
        className={`
          border-2 border-dashed rounded-xl p-6 text-center transition-colors duration-300
          ${isDragOver ? 'border-[#E0FE10] bg-[#E0FE10]/10' : 'border-zinc-700'}
        `}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {videoPreview ? (
          <div className="relative">
            <video 
              src={videoPreview} 
              controls 
              className="w-full rounded-xl"
            />
            <button 
              onClick={clearVideo}
              className="absolute top-2 right-2 bg-red-500 text-white p-2 rounded-full"
            >
              ✕
            </button>
          </div>
        ) : (
          <>
            <input 
              type="file" 
              ref={fileInputRef}
              accept="video/mp4,video/quicktime,video/x-msvideo"
              onChange={handleFileInputChange}
              className="hidden"
            />
            <div className="text-zinc-400">
              <p className="mb-4">Drag and drop videos here</p>
              <p className="mb-4">or</p>
              <button 
                onClick={() => fileInputRef.current?.click()}
                className="bg-[#E0FE10] text-black px-4 py-2 rounded-lg"
              >
                Browse Files
              </button>
            </div>
          </>
        )}
      </div>

      {videoPreview && (
        <div className="mt-6 space-y-4">
          {/* Exercise Name */}
          <div>
            <label className="block text-sm text-zinc-300 mb-2">Exercise Name</label>
            <input
              type="text"
              value={exerciseName}
              onChange={(e) => setExerciseName(e.target.value)}
              placeholder="Enter exercise name"
              className="w-full bg-zinc-800 border border-zinc-600 rounded-lg p-3 text-white placeholder-zinc-400"
            />
          </div>

          {/* Exercise Category */}
          <div>
            <label className="block text-sm text-zinc-300 mb-2">Exercise Category</label>
            <select
              value={exerciseCategory}
              onChange={(e) => setExerciseCategory(e.target.value)}
              className="w-full bg-zinc-800 border border-zinc-600 rounded-lg p-3 text-white"
            >
              {categories.map(category => (
                <option key={category} value={category}>{category}</option>
              ))}
            </select>
          </div>

          {/* Tags */}
          <div>
            <label className="block text-sm text-zinc-300 mb-2">Tags</label>
            <div className="flex mb-2">
              <input
                type="text"
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleAddTag()}
                placeholder="Add a tag"
                className="flex-grow bg-zinc-800 border border-zinc-600 rounded-lg p-3 text-white placeholder-zinc-400"
              />
              <button 
                onClick={handleAddTag}
                className="ml-2 bg-[#E0FE10] text-black px-4 rounded-lg"
              >
                Add
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {tags.map(tag => (
                <div 
                  key={tag} 
                  className="bg-zinc-700 text-white px-3 py-1 rounded-full flex items-center"
                >
                  {tag}
                  <button 
                    onClick={() => handleRemoveTag(tag)}
                    className="ml-2 text-red-400"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Caption */}
          <div>
            <label className="block text-sm text-zinc-300 mb-2">Caption</label>
            <textarea
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="Add a caption to your exercise..."
              className="w-full bg-zinc-800 border border-zinc-600 rounded-lg p-3 text-white placeholder-zinc-400"
              rows={4}
            />
          </div>

          {/* Submit Button */}
          <button 
            onClick={handleSubmit}
            disabled={!exerciseName || isUploading}
            className="w-full bg-[#E0FE10] text-black font-semibold py-3 px-4 rounded-lg hover:bg-[#c8e60e] transition-colors disabled:opacity-50"
          >
            {isUploading ? 'Uploading...' : 'Post Exercise'}
          </button>
          <div className="h-40"></div>
        </div>
      )}
    </div>
  );
};

export default Create;