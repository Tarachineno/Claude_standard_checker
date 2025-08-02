# EU Harmonized Standards Checker - Web Application

This application has been converted from a Python CLI tool to a modern web application ready for deployment on Netlify.

## 🚀 Quick Start

### Local Development

1. **Install Dependencies**
   ```bash
   pip install -r requirements.txt
   ```

2. **Run the Application**
   ```bash
   python app.py
   ```
   The app will be available at `http://localhost:5001`

### Netlify Deployment

1. **Connect Repository**
   - Link your GitHub repository to Netlify
   - Netlify will automatically detect the `netlify.toml` configuration

2. **Deploy**
   - Push your code to the main branch
   - Netlify will automatically build and deploy your app

## 📁 Project Structure

```
Claude_standard_checker/
├── app.py                     # Flask web application
├── static/                    # Frontend files
│   ├── index.html            # Main HTML page
│   ├── style.css             # CSS styling
│   └── script.js             # JavaScript functionality
├── netlify/                   # Netlify configuration
│   └── functions/
│       └── api.py            # Serverless function handler
├── netlify.toml              # Netlify deployment config
├── requirements.txt          # Python dependencies
├── requirements-netlify.txt  # Netlify-specific dependencies
├── runtime.txt              # Python version for Netlify
└── [original Python modules] # Core application logic
```

## 🌟 Features

### Web Interface
- **Modern UI**: Clean, responsive design that works on all devices
- **Tabbed Navigation**: Easy switching between different functions
- **Real-time Updates**: Interactive feedback and loading states
- **File Upload**: Drag-and-drop PDF certificate upload
- **Export Functionality**: Download results as CSV files

### Core Functionality
- **OJ Standards Checking**: Fetch EU harmonized standards by directive
- **Standards Search**: Search across all standards with filtering
- **Certificate Analysis**: Upload and analyze ISO17025 PDF certificates
- **Standards Comparison**: Compare certificates against EU directives
- **Batch Operations**: Compare against all directives simultaneously

### API Endpoints
- `GET /api/health` - Health check
- `GET /api/directives` - Get available directives
- `GET /api/standards/{directive}` - Get standards for a directive
- `GET /api/search?q={query}` - Search standards
- `POST /api/upload-certificate` - Upload ISO17025 certificate
- `POST /api/compare` - Compare standards with a directive
- `POST /api/batch-compare` - Compare with all directives

## 🔧 Configuration

### Environment Variables
The application uses the existing configuration from `config.py` and `oj_config.json`.

### File Upload Limits
- Maximum file size: 16MB
- Supported formats: PDF only
- Temporary file handling with automatic cleanup

### CORS Configuration
- Enabled for all origins in development
- Configure appropriately for production

## 🛠️ Development

### Adding New Features
1. Add API endpoints in `app.py`
2. Update the frontend in `static/` files
3. Test locally before deployment

### Testing
```bash
# Test the health endpoint
curl http://localhost:5001/api/health

# Test directives endpoint
curl http://localhost:5001/api/directives

# Test standards endpoint
curl http://localhost:5001/api/standards/RED
```

### Debugging
- Check browser console for JavaScript errors
- Review Flask logs for API issues
- Use browser network tab to inspect API calls

## 📱 Mobile Support

The application is fully responsive and works on:
- Desktop computers
- Tablets
- Mobile phones
- Various screen sizes and orientations

## 🔒 Security Considerations

- File upload validation (PDF only, size limits)
- Secure filename handling
- CORS configuration
- Input sanitization
- Error handling without information leakage

## 🚀 Netlify Deployment Features

- **Serverless Functions**: API endpoints run as serverless functions
- **Static Hosting**: Frontend served from CDN
- **Automatic Deployments**: Deploy on every push to main branch
- **Environment Variables**: Configure via Netlify dashboard
- **Custom Domain**: Support for custom domains

## 📊 Performance

- **Caching**: Implements caching for OJ standards (24-hour TTL)
- **Compression**: Static files are automatically compressed
- **CDN**: Netlify provides global CDN for fast loading
- **Lazy Loading**: Components load on demand

## 🐛 Troubleshooting

### Common Issues

1. **Flask Import Errors**
   - Ensure all dependencies are installed: `pip install -r requirements.txt`

2. **File Upload Failures**
   - Check file size (max 16MB)
   - Ensure file is PDF format
   - Check browser console for errors

3. **API Connection Issues**
   - Verify Flask server is running
   - Check CORS configuration
   - Review network connectivity

4. **Netlify Deployment Issues**
   - Check `netlify.toml` configuration
   - Verify all dependencies in `requirements-netlify.txt`
   - Review build logs in Netlify dashboard

### Debug Mode
Enable debug mode for detailed error messages:
```python
app.run(debug=True)
```

## 📞 Support

For issues or questions:
1. Check the browser console for errors
2. Review the Flask application logs
3. Test API endpoints directly with curl
4. Check Netlify build logs if deployment fails

## 🔄 Migration from CLI

The web application maintains all functionality from the original CLI tool:
- All core modules remain unchanged
- Same data processing logic
- Compatible with existing cache and configuration files
- API provides same functionality as CLI commands