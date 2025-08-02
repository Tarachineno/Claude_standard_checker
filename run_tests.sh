#!/bin/bash

# Activate the test environment
source test_env/bin/activate

echo "=== EU Harmonized Standards Checker - Test Suite ==="
echo "Activating test environment..."

# Run all tests with coverage
echo -e "\n1. Running all tests with coverage..."
pytest --cov=. --cov-report=term-missing --cov-report=html:htmlcov

# Run specific test categories
echo -e "\n2. Running unit tests only..."
pytest -m unit -v

echo -e "\n3. Running integration tests only..."
pytest -m integration -v

# Run existing test scripts for compatibility
echo -e "\n4. Running existing test scripts..."
echo "Running system test..."
python test_system.py

echo -e "\nRunning sorting test..."
python test_sorting.py

echo -e "\nRunning RE sources test..."
python test_re_sources.py

echo -e "\n=== Test Summary ==="
echo "- Coverage report: htmlcov/index.html"
echo "- All tests completed"

deactivate