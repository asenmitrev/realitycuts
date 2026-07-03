import type { WalkthroughStep } from './Walkthrough';

export const facelessAIVideoWalkthrough: WalkthroughStep[] = [
  {
    title: 'Faceless AI Video',
    description:
      'Create professional AI videos without showing your face. Perfect for tutorials, explainers, and content creation.',
    elementSelector: 'h2.chakra-heading:first-of-type',
    position: 'bottom'
  },
  {
    title: 'Script Editor',
    description: 'Type or paste your script here. The AI will convert this text into spoken narration for your video.',
    elementSelector: 'textarea',
    position: 'right'
  },
  {
    title: 'Voice Selection',
    description:
      'Choose from various AI voices to narrate your video. Premium voices offer more natural-sounding options.',
    elementSelector: '.voice-selector',
    position: 'bottom'
  },
  {
    title: 'Source Footage',
    description:
      'Select where your video footage will come from. Choose from stock footage, public libraries, or your personal collections.',
    elementSelector: '.source-footage-heading',
    position: 'top'
  },
  {
    title: 'Personal Libraries',
    description: 'Use your own uploaded footage collections for a more personalized video.',
    elementSelector: '.personal-libraries-heading',
    position: 'right'
  },
  {
    title: 'Public Libraries',
    description: 'Browse and select from various themed footage libraries to match your script content.',
    elementSelector: '.public-libraries-heading',
    position: 'right'
  },
  {
    title: 'Auto-select Public Libraries',
    description: 'AI will suggest public libraries based on your script content.',
    elementSelector: '.autosuggest-public-libraries-button',
    position: 'left'
  },
  {
    title: 'Stock Footage',
    description: 'Use professional stock footage from Pexels to enhance your video.',
    elementSelector: '.stock-footage-heading',
    position: 'right'
  },
  {
    title: 'Generate Video',
    description: "When you're ready, click Generate to create your AI video.",
    elementSelector: 'button[type="submit"]',
    position: 'top'
  }
];

export const addToLibraryWalkthrough: WalkthroughStep[] = [
  {
    title: 'Library Name',
    description: 'Give your library a descriptive name to easily identify it later.',
    elementSelector: 'input[placeholder="Enter library name"]',
    position: 'bottom'
  },
  // {
  //   title: 'Public Library',
  //   description:
  //     'Toggle this switch to make your library visible to other users. Only enable this if you have the rights to share the content.',
  //   elementSelector: 'input[type="checkbox"]',
  //   position: 'left'
  // },
  {
    title: 'YouTube Links',
    description:
      'Add YouTube video links to include in your library. You can add multiple links and they will be cut into individual clips and classified automatically.',
    elementSelector: 'input[placeholder="Paste YouTube link here"]',
    position: 'bottom'
  },
  {
    title: 'File Upload',
    description:
      'Drag and drop your own video or image files here or click to browse. Supported formats include mp4, mov, m4v, mpeg, mpg, webm, avi, and mkv.',
    elementSelector: '.dropzone',
    position: 'top'
  },
  {
    title: 'Library Minutes',
    description:
      'Keep track of your remaining library processing minutes. Each video will consume minutes based on its duration.',
    elementSelector: '.library-minutes',
    position: 'top'
  },
  {
    title: 'Create Library',
    description: "When you're ready, click this button to create your library and start processing the videos.",
    elementSelector: 'button[type="submit"]',
    position: 'top'
  }
];

export const videoEditorWalkthrough: WalkthroughStep[] = [
  {
    title: 'Welcome to Video Editor!',
    description:
      "This is your complete video editing workspace. Let's explore the key features to help you create amazing content.",
    elementSelector: 'h1.chakra-heading, h2.chakra-heading',
    position: 'bottom'
  },
  {
    title: 'Edit Your Transcript',
    description:
      'Select text in this transcript to edit your video. You can add, remove, or modify words to change what appears in your final video. This directly affects the visual content and timing.',
    elementSelector: 'div[role="tabpanel"]:first-child',
    position: 'right'
  },
  {
    title: 'Downloads - Your Export Center',
    description:
      'This is your video export hub! After clicking Export, processed videos appear here. You can download different formats (MP4, vertical versions), check export status, and access all your rendered videos.',
    elementSelector: '[data-walkthrough-step="downloads"]',
    position: 'left'
  },
  {
    title: 'Toggle Video',
    description:
      'Want to see other video options? The AI creates several versions for each part of your project - just click to browse and pick your favorite.',
    elementSelector: 'button[aria-label="Toggle Alt"]',
    position: 'top'
  },
  {
    title: 'Search & Replace Footage',
    description:
      'Click this magnifying glass icon to search and replace individual video clips. Browse your personal libraries, public collections, or stock footage to find better alternatives for any segment.',
    elementSelector: 'button[aria-label="Open Search"]',
    position: 'top'
  },
  {
    title: 'Caption Settings',
    description:
      'Customize your subtitles. Change fonts, colors, size, positioning, and animation styles. You can also download SRT subtitle files for other platforms.',
    elementSelector: 'button[aria-label="open-caption-settings"]',
    position: 'top'
  },
  {
    title: 'Orientation Toggle',
    description:
      'Switch between landscape (16:9) and portrait (9:16) orientations. Use landscape for YouTube/desktop viewing, or portrait for TikTok, Instagram Stories, and mobile-first content.',
    elementSelector: 'button[aria-label="toggle-orientation"]',
    position: 'top'
  },
  {
    title: 'Playback Speed',
    description:
      'Click this button to cycle through different playback speeds (1x, 1.5x, 2x). Useful for quickly reviewing your video.',
    elementSelector: '.playback-speed-control',
    position: 'top'
  },
  {
    title: 'Fullscreen Mode',
    description:
      'Toggle fullscreen mode to get a better view of your video while editing. Perfect for detailed review and presentation mode.',
    elementSelector: 'button[aria-label="enter-fullscreen"], button[aria-label="exit-fullscreen"]',
    position: 'left'
  }
];

export const libraryListWalkthrough: WalkthroughStep[] = [
  {
    title: 'Welcome to Your Libraries!',
    description:
      'Libraries are collections of video footage that you can use to create AI videos. Think of them as organized folders of video clips that are automatically tagged and searchable.',
    elementSelector: 'h2.chakra-heading',
    position: 'bottom'
  },
  {
    title: 'Personal vs Public Libraries',
    description:
      'You have access to two types of libraries: Personal libraries that you create and own, and Public libraries shared by the community.',
    elementSelector: '[role="tablist"]',
    position: 'bottom'
  }
];

export const videoListWalkthrough: WalkthroughStep[] = [
  {
    title: 'Welcome to Your Dashboard!',
    description:
      'This is your project dashboard where you can manage all your video projects and navigate the platform. Let me show you around!',
    elementSelector: 'h1, h2.chakra-heading',
    position: 'bottom'
  },
  {
    title: 'Projects Navigation',
    description:
      'Click here to view all your video projects. This is where you can manage, edit, and organize your AI-generated videos.',
    elementSelector: 'nav a[href="/videos"]',
    position: 'bottom'
  },
  {
    title: 'Libraries Section',
    description:
      'Access your video libraries here. Libraries are collections of footage that you can use to create videos. You can create personal libraries or browse public ones.',
    elementSelector: 'nav a[href="/libraries"]',
    position: 'bottom'
  },
  {
    title: 'Add Library Button',
    description:
      'Click this button to create a new video library. You can add your own footage or YouTube videos to build custom collections for your projects.',
    elementSelector: '.newlibrary',
    position: 'bottom'
  },
  {
    title: 'Create New Project',
    description:
      'Ready to create your first AI video? Click this button to start a new project. You can create faceless videos from scripts or audio files.',
    elementSelector: '.newproject',
    position: 'bottom'
  }
];
