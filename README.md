# River Texture Editor

A specialized image editor for creating and editing river textures for game development. This editor works with BMP files where:
- **Blue (0,0,255)** = River segments
- **Green (0,255,0)** = River sources
- **Red (255,0,0)** = River junctions/meeting points
- **Black (0,0,0)** = Non-river areas

## Features

### Drawing Tools
- **River Tool** - Draw river segments (Blue)
- **Source Tool** - Mark river sources (Green)
- **Junction Tool** - Mark where rivers meet (Red)
- **Eraser Tool** - Remove drawings (Black)
- **Adjustable Brush Size** - From 1 to 50 pixels

### Navigation
- **Zoom In/Out** - Use buttons or mouse wheel
- **Pan** - Hold Shift+Left Click or Middle Mouse Button and drag
- **Reset View** - Return to 100% zoom and centered view

### File Operations
- **Load BMP Files** - Click "Choose File" to load your texture
- **Save BMP Files** - Exports as proper BMP format maintaining exact colors

### Editing Features
- **Undo/Redo** - Up to 50 steps of history
- **Clear All** - Reset the entire canvas to black
- **Real-time Position Display** - Shows current mouse coordinates
- **Keyboard Shortcuts**:
  - `Ctrl+Z` - Undo
  - `Ctrl+Shift+Z` or `Ctrl+Y` - Redo
  - `Ctrl+S` - Save BMP

## Usage

1. **Open the Editor**
   - Simply open `index.html` in your web browser (Chrome, Firefox, Edge recommended)
   - No server required - runs completely locally

2. **Load Your Texture**
   - Click "Choose File" and select your 4081x4081 BMP file
   - The image will load and display in the editor

3. **Edit Your Rivers**
   - Select a tool from the toolbar
   - Adjust brush size if needed
   - Click and drag to draw
   - Use zoom and pan to work on details

4. **Save Your Work**
   - Click "Save BMP" to download the edited texture
   - The file will be saved as `river_texture.bmp`

## Technical Notes

- The editor preserves exact RGB values (no anti-aliasing or color blending)
- Rivers must be cardinally connected (no diagonal connections) for proper game functionality
- The editor uses HTML5 Canvas with pixelated rendering for precise pixel editing
- Large images (4081x4081) are handled efficiently with optimized rendering

## Browser Compatibility

Works best in modern browsers:
- Chrome 90+
- Firefox 88+
- Edge 90+
- Safari 14+

## Tips

- Use smaller brush sizes (1-3 pixels) for precise river connections
- Zoom in to ensure cardinal connections between river segments
- The checkered background helps distinguish black areas from transparency
- Save frequently as browser refresh will lose unsaved changes 