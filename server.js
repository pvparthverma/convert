const express = require('express');
const multer = require('multer');
const ffmpeg = require('fluent-ffmpeg');
const fs = require('fs');
const path = require('path');

const app = express();
const upload = multer({ dest: 'uploads/' }); 

app.use(express.static('public'));

const FORMAT_ALIASES = {
    jpg: { ffmpegFormat: 'image2', extension: 'jpg', outputOptions: ['-vframes 1'] },
    jpeg: { ffmpegFormat: 'image2', extension: 'jpg', outputOptions: ['-vframes 1'] },
    png: { ffmpegFormat: 'image2', extension: 'png', outputOptions: ['-vframes 1'] },
    mp4: { ffmpegFormat: 'mp4', extension: 'mp4' },
    mp3: { ffmpegFormat: 'mp3', extension: 'mp3' },
    avi: { ffmpegFormat: 'avi', extension: 'avi' },
    gif: { ffmpegFormat: 'gif', extension: 'gif' },
    wav: { ffmpegFormat: 'wav', extension: 'wav' },
    mkv: { ffmpegFormat: 'matroska', extension: 'mkv' }
};

function resolveOutputConfig(formatInput = '') {
    const normalized = String(formatInput).trim().toLowerCase();

    if (!normalized) {
        return null;
    }

    if (FORMAT_ALIASES[normalized]) {
        return FORMAT_ALIASES[normalized];
    }

    return {
        ffmpegFormat: normalized,
        extension: normalized
    };
}

// Variable to track progress for your local tool
let currentProgress = 0;

// New endpoint for the frontend to check progress
app.get('/progress', (req, res) => {
    res.json({ progress: currentProgress });
});

app.post('/convert', upload.single('file'), (req, res) => {
    if (!req.file) {
        return res.status(400).send('No file uploaded.');
    }

    const outputConfig = resolveOutputConfig(req.body.format);

    if (!outputConfig) {
        try { fs.unlinkSync(req.file.path); } catch (e) {}
        return res.status(400).send('Please provide a valid output format.');
    }

    const inputPath = req.file.path;
    const outputPath = path.join(__dirname, 'uploads', `output-${Date.now()}.${outputConfig.extension}`);

    console.log(`Starting conversion to ${outputConfig.ffmpegFormat}...`);
    
    // Reset progress at the start of a new job
    currentProgress = 0; 

    let command = ffmpeg(inputPath).toFormat(outputConfig.ffmpegFormat);

    if (outputConfig.outputOptions?.length) {
        command = command.outputOptions(outputConfig.outputOptions);
    }

    command
        .on('progress', (progress) => {
            // fluent-ffmpeg calculates the percentage based on file duration
            if (progress.percent) {
                currentProgress = Math.round(progress.percent);
                console.log(`Processing: ${currentProgress}% done`);
            }
        })
        .on('end', () => {
            console.log('Conversion complete.');
            currentProgress = 100; // Ensure it hits 100% at the end
            
            res.download(outputPath, `converted.${outputConfig.extension}`, (err) => {
                if (err) console.error("Error downloading file:", err);
                
                // Clean up files
                try { fs.unlinkSync(inputPath); } catch (e) {}
                try { fs.unlinkSync(outputPath); } catch (e) {}
            });
        })
        .on('error', (err) => {
            console.error('Error during conversion:', err.message);
            res.status(500).send(`Error during conversion: ${err.message}`);
            try { fs.unlinkSync(inputPath); } catch (e) {}
        })
        .save(outputPath);
});

const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Server is running at http://localhost:${PORT}`);
});