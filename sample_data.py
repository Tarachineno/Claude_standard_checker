"""
Sample data for testing and demonstration purposes
"""

from data_models import Standard
from datetime import datetime

# Sample RE Directive standards
SAMPLE_RE_STANDARDS = [
    Standard(
        number="EN 301 489-17",
        version="V3.3.1",
        directive="RE",
        title="ElectroMagnetic Compatibility (EMC) standard for radio equipment and services; Part 17: Specific conditions for Broadband Data Transmission Systems",
        status="Active",
        publication_date="2023-03-15",
        amendment_date="2025-01-28"
    ),
    Standard(
        number="EN 301 489-1",
        version="V2.2.3",
        directive="RE",
        title="ElectroMagnetic Compatibility (EMC) standard for radio equipment and services; Part 1: Common technical requirements",
        status="Active",
        publication_date="2019-03-12",
        amendment_date="2023-11-27"
    ),
    Standard(
        number="EN 301 489-3",
        version="V2.1.1",
        directive="RE",
        title="ElectroMagnetic Compatibility (EMC) standard for radio equipment and services; Part 3: Specific conditions for Short-Range Devices (SRD)",
        status="Active",
        publication_date="2017-05-16",
        amendment_date="2023-10-03"
    ),
    Standard(
        number="EN 300 328",
        version="V2.2.2",
        directive="RE",
        title="Wideband transmission systems; Data transmission equipment operating in the 2,4 GHz ISM band",
        status="Active",
        publication_date="2016-11-30",
        amendment_date="2025-05-14"
    ),
    Standard(
        number="EN 301 893",
        version="V2.1.1",
        directive="RE",
        title="5 GHz RLAN; Harmonised Standard for access to radio spectrum",
        status="Active",
        publication_date="2017-05-12",
        amendment_date="2023-11-27"
    ),
    Standard(
        number="EN 302 065-1",
        version="V2.1.1",
        directive="RE",
        title="Short Range Devices (SRD) using Ultra Wide Band (UWB) technology; Part 1: Technical requirements and test methods",
        status="Active",
        publication_date="2016-07-20",
        amendment_date="2025-01-28"
    ),
    Standard(
        number="EN 300 220-1",
        version="V3.1.1",
        directive="RE",
        title="Short Range Devices (SRD); Radio equipment to be used in the 25 MHz to 1 000 MHz frequency range; Part 1: Technical characteristics and test methods",
        status="Active",
        publication_date="2012-01-04",
        amendment_date="2023-10-03"
    ),
    Standard(
        number="EN 303 413",
        version="V1.1.1",
        directive="RE",
        title="Satellite Earth Stations and Systems (SES); Global Navigation Satellite System (GNSS) receivers",
        status="Active",
        publication_date="2017-05-12",
        amendment_date="2025-05-14"
    )
]

# Sample EMC Directive standards
SAMPLE_EMC_STANDARDS = [
    Standard(
        number="EN 55032",
        version="V2010+A11:2020",
        directive="EMC",
        title="Electromagnetic compatibility of multimedia equipment - Emission requirements",
        status="Active",
        publication_date="2012-12-01",
        amendment_date="2024-04-19"
    ),
    Standard(
        number="EN 61000-4-2",
        version="V2008+A1:2013",
        directive="EMC",
        title="Electromagnetic compatibility (EMC) - Part 4-2: Testing and measurement techniques - Electrostatic discharge immunity test",
        status="Active",
        publication_date="2008-12-01",
        amendment_date="2024-10-30"
    ),
    Standard(
        number="EN 61000-4-3",
        version="V2006+A1:2007+A2:2010",
        directive="EMC",
        title="Electromagnetic compatibility (EMC) - Part 4-3: Testing and measurement techniques - Radiated, radio-frequency, electromagnetic field immunity test",
        status="Active",
        publication_date="2006-02-01",
        amendment_date="2024-04-19"
    )
]

# Sample LVD Directive standards
SAMPLE_LVD_STANDARDS = [
    Standard(
        number="EN 62368-1",
        version="V2014+A11:2017",
        directive="LVD",
        title="Audio/video, information and communication technology equipment - Part 1: Safety requirements",
        status="Active",
        publication_date="2014-02-26",
        amendment_date="2024-10-30"
    ),
    Standard(
        number="EN 60950-1",
        version="V2006+A11:2009+A1:2010+A12:2011+A2:2013",
        directive="LVD",
        title="Information technology equipment - Safety - Part 1: General requirements",
        status="Withdrawn",
        publication_date="2006-01-01",
        amendment_date="2020-12-20"
    )
]

def get_sample_standards():
    """Get all sample standards organized by directive"""
    return {
        'RE': SAMPLE_RE_STANDARDS,
        'EMC': SAMPLE_EMC_STANDARDS,
        'LVD': SAMPLE_LVD_STANDARDS
    }

def get_sample_standards_for_directive(directive: str):
    """Get sample standards for a specific directive"""
    all_standards = get_sample_standards()
    return all_standards.get(directive.upper(), [])