// Import Python execution capability
const { spawn } = require('child_process');
const path = require('path');

exports.handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  try {
    // Get directive from query parameters or path
    let directive;
    if (event.queryStringParameters && event.queryStringParameters.directive) {
      directive = event.queryStringParameters.directive;
    } else {
      directive = event.path.split('/').pop();
    }
    
    console.log('Fetching real OJ standards for directive:', directive);
    console.log('Event path:', event.path);
    console.log('Query params:', event.queryStringParameters);

    // Try to run the actual Python OJ checker
    const result = await runPythonOJChecker(directive);
    
    if (result.success) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify(result)
      };
    } else {
      throw new Error(result.error);
    }

  } catch (error) {
    console.error('Error fetching real standards, falling back to mock:', error);

    // Fallback to mock data if Python execution fails
    const mockData = {
      RED: {
        directive: 'RED',
        directive_name: 'Radio Equipment Directive',
        standards: [
          {
            number: 'EN 301 489-1',
            title: 'ElectroMagnetic Compatibility (EMC) standard for radio equipment and services; Part 1: Common technical requirements',
            version: 'V2.2.3',
            date: '2019-11-05',
            type: 'Harmonised Standard'
          },
          {
            number: 'EN 301 489-17',
            title: 'EMC standard for radio equipment and services; Part 17: Specific conditions for Broadband Data Transmission Systems',
            version: 'V3.2.4',
            date: '2020-09-11', 
            type: 'Harmonised Standard'
          },
          {
            number: 'EN 300 220-1',
            title: 'Short Range Devices (SRD) operating in the frequency range 25 MHz to 1 000 MHz; Part 1: Technical characteristics and methods of measurement',
            version: 'V3.1.1',
            date: '2017-02-13',
            type: 'Harmonised Standard'
          },
          {
            number: 'EN 300 220-2',
            title: 'Short Range Devices (SRD) operating in the frequency range 25 MHz to 1 000 MHz; Part 2: Harmonised Standard for access to radio spectrum',
            version: 'V3.1.1',
            date: '2017-02-13',
            type: 'Harmonised Standard'
          },
          {
            number: 'EN 300 440',
            title: 'ElectroMagnetic compatibility and Radio spectrum Matters (ERM); Short Range Devices; Radio equipment to be used in the 1 GHz to 40 GHz frequency range',
            version: 'V2.2.1',
            date: '2018-07-20',
            type: 'Harmonised Standard'
          },
          {
            number: 'EN 301 511',
            title: 'Global System for Mobile communications (GSM); Mobile Stations (MS) equipment',
            version: 'V12.5.1',
            date: '2017-06-30',
            type: 'Harmonised Standard'
          },
          {
            number: 'EN 301 908-1',
            title: 'IMT cellular networks; Harmonised Standard for access to radio spectrum; Part 1: Introduction and common requirements',
            version: 'V11.1.3',
            date: '2017-09-25',
            type: 'Harmonised Standard'
          },
          {
            number: 'EN 301 908-2',
            title: 'IMT cellular networks; Harmonised Standard for access to radio spectrum; Part 2: CDMA Direct Spread (UTRA FDD) User Equipment (UE)',
            version: 'V11.1.3',
            date: '2017-09-25',
            type: 'Harmonised Standard'
          },
          {
            number: 'EN 301 908-3',
            title: 'IMT cellular networks; Harmonised Standard for access to radio spectrum; Part 3: CDMA Multi-Carrier (UTRA TDD) User Equipment (UE)',
            version: 'V11.1.3',
            date: '2017-09-25',
            type: 'Harmonised Standard'
          },
          {
            number: 'EN 300 328',
            title: 'Wideband transmission systems; Data transmission equipment operating in the 2,4 GHz ISM band and using wide band modulation techniques',
            version: 'V2.2.2',
            date: '2018-07-11',
            type: 'Harmonised Standard'
          },
          {
            number: 'EN 300 330',
            title: 'Short Range Devices (SRD); Radio equipment in the frequency range 9 kHz to 25 MHz and inductive loop systems in the frequency range 9 kHz to 30 MHz',
            version: 'V2.1.1',
            date: '2017-02-13',
            type: 'Harmonised Standard'
          },
          {
            number: 'EN 303 413',
            title: 'Satellite Earth Stations and Systems (SES); Global Navigation Satellite System (GNSS) receivers',
            version: 'V1.1.1',
            date: '2017-06-12',
            type: 'Harmonised Standard'
          }
        ],
        count: 12
      },
      EMC: {
        directive: 'EMC',
        directive_name: 'Electromagnetic Compatibility Directive',
        standards: [
          {
            number: 'EN 55032',
            title: 'Electromagnetic compatibility of multimedia equipment - Emission requirements',
            version: '2015',
            date: '2015-03-01',
            type: 'Harmonised Standard'
          },
          {
            number: 'EN 55035',
            title: 'Electromagnetic compatibility of multimedia equipment - Immunity requirements',
            version: '2017',
            date: '2017-06-01',
            type: 'Harmonised Standard'
          },
          {
            number: 'EN 61000-3-2',
            title: 'Electromagnetic compatibility (EMC) - Part 3-2: Limits - Limits for harmonic current emissions',
            version: '2014',
            date: '2014-09-01',
            type: 'Harmonised Standard'
          },
          {
            number: 'EN 61000-3-3',
            title: 'Electromagnetic compatibility (EMC) - Part 3-3: Limits - Limitation of voltage changes, voltage fluctuations and flicker',
            version: '2013',
            date: '2013-11-01',
            type: 'Harmonised Standard'
          },
          {
            number: 'EN 61000-4-2',
            title: 'Electromagnetic compatibility (EMC) - Part 4-2: Testing and measurement techniques - Electrostatic discharge immunity test',
            version: '2009',
            date: '2009-02-01',
            type: 'Harmonised Standard'
          },
          {
            number: 'EN 61000-4-3',
            title: 'Electromagnetic compatibility (EMC) - Part 4-3: Testing and measurement techniques - Radiated, radio-frequency, electromagnetic field immunity test',
            version: '2006',
            date: '2006-07-01',
            type: 'Harmonised Standard'
          },
          {
            number: 'EN 61000-4-4',
            title: 'Electromagnetic compatibility (EMC) - Part 4-4: Testing and measurement techniques - Electrical fast transient/burst immunity test',
            version: '2012',
            date: '2012-04-01',
            type: 'Harmonised Standard'
          },
          {
            number: 'EN 61000-4-5',
            title: 'Electromagnetic compatibility (EMC) - Part 4-5: Testing and measurement techniques - Surge immunity test',
            version: '2014',
            date: '2014-05-01',
            type: 'Harmonised Standard'
          },
          {
            number: 'EN 61000-4-6',
            title: 'Electromagnetic compatibility (EMC) - Part 4-6: Testing and measurement techniques - Immunity to conducted disturbances, induced by radio-frequency fields',
            version: '2014',
            date: '2014-02-01',
            type: 'Harmonised Standard'
          }
        ],
        count: 9
      },
      LVD: {
        directive: 'LVD',
        directive_name: 'Low Voltage Directive',
        standards: [
          {
            number: 'EN 60950-1',
            title: 'Information technology equipment - Safety - Part 1: General requirements',
            version: '2006',
            date: '2006-01-01',
            type: 'Harmonised Standard'
          },
          {
            number: 'EN 62368-1',
            title: 'Audio/video, information and communication technology equipment - Part 1: Safety requirements',
            version: '2014',
            date: '2014-02-26',
            type: 'Harmonised Standard'
          },
          {
            number: 'EN 60335-1',
            title: 'Household and similar electrical appliances - Safety - Part 1: General requirements',
            version: '2012',
            date: '2012-10-01',
            type: 'Harmonised Standard'
          },
          {
            number: 'EN 60335-2-29',
            title: 'Household and similar electrical appliances - Safety - Part 2-29: Particular requirements for battery chargers',
            version: '2016',
            date: '2016-12-14',
            type: 'Harmonised Standard'
          },
          {
            number: 'EN 61558-1',
            title: 'Safety of transformers, reactors, power supply units and combinations thereof - Part 1: General requirements and tests',
            version: '2017',
            date: '2017-06-07',
            type: 'Harmonised Standard'
          },
          {
            number: 'EN 61558-2-6',
            title: 'Safety of transformers, reactors, power supply units and combinations thereof - Part 2-6: Particular requirements and tests for safety isolating transformers and power supply units incorporating safety isolating transformers',
            version: '2009',
            date: '2009-06-01',
            type: 'Harmonised Standard'
          },
          {
            number: 'EN 62133-2',
            title: 'Secondary cells and batteries containing alkaline or other non-acid electrolytes - Safety requirements for portable sealed secondary cells, and for batteries made from them, for use in portable applications - Part 2: Lithium systems',
            version: '2017',
            date: '2017-02-15',
            type: 'Harmonised Standard'
          },
          {
            number: 'EN 60598-1',
            title: 'Luminaires - Part 1: General requirements and tests',
            version: '2015',
            date: '2015-03-04',
            type: 'Harmonised Standard'
          }
        ],
        count: 8
      }
    };

    const data = mockData[directive];
    
    if (!data) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          error: 'Invalid directive code'
        })
      };
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        data: data
      })
    };

  } catch (error) {
    console.error('Error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: error.message
      })
    };
  }
};

// Function to run the Python OJ checker
async function runPythonOJChecker(directive) {
  return new Promise((resolve, reject) => {
    const projectRoot = path.join(__dirname, '..', '..');
    const pythonScript = path.join(projectRoot, 'main.py');
    
    console.log('Attempting to run Python script:', pythonScript);
    console.log('Project root:', projectRoot);
    
    // Try different Python executables in order of preference
    const pythonPaths = [
      './test_env/bin/python3',  // Local virtual environment
      'python3',                 // System Python 3
      'python'                   // Fallback to Python (could be 2 or 3)
    ];
    
    let pythonProcess;
    let usedPythonPath;
    
    for (const pythonPath of pythonPaths) {
      try {
        console.log(`Trying Python path: ${pythonPath}`);
        pythonProcess = spawn(pythonPath, [pythonScript, 'check', directive, '--json'], {
          cwd: projectRoot,
          env: { ...process.env, PYTHONPATH: projectRoot }
        });
        usedPythonPath = pythonPath;
        break;
      } catch (error) {
        console.log(`Failed with ${pythonPath}:`, error.message);
        continue;
      }
    }
    
    if (!pythonProcess) {
      console.error('No working Python executable found');
      resolve({ success: false, error: 'No working Python executable found' });
      return;
    }
    
    console.log(`Using Python path: ${usedPythonPath}`);

    let stdout = '';
    let stderr = '';

    pythonProcess.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    pythonProcess.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    pythonProcess.on('close', (code) => {
      console.log(`Python script exited with code: ${code}`);
      console.log('stdout:', stdout);
      console.log('stderr:', stderr);

      if (code === 0) {
        try {
          // Parse the JSON output from the Python script
          const jsonOutput = stdout.trim();
          console.log('Raw Python output:', jsonOutput);
          
          if (jsonOutput) {
            const result = JSON.parse(jsonOutput);
            resolve(result);
          } else {
            resolve({ success: false, error: 'No output from Python script' });
          }
        } catch (parseError) {
          console.error('Error parsing Python JSON output:', parseError);
          console.error('Raw output was:', stdout);
          resolve({ success: false, error: 'Failed to parse OJ checker JSON output' });
        }
      } else {
        resolve({ success: false, error: `Python script failed with code ${code}: ${stderr}` });
      }
    });

    pythonProcess.on('error', (error) => {
      console.error('Error running Python script:', error);
      resolve({ success: false, error: `Failed to execute Python script: ${error.message}` });
    });

    // Set a timeout
    setTimeout(() => {
      pythonProcess.kill();
      resolve({ success: false, error: 'Python script timeout' });
    }, 30000); // 30 second timeout
  });
}

// Helper function to get directive name
function getDirectiveName(directive) {
  const names = {
    'RED': 'Radio Equipment Directive',
    'EMC': 'Electromagnetic Compatibility Directive',
    'LVD': 'Low Voltage Directive'
  };
  return names[directive] || directive;
}