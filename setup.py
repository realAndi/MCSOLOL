from setuptools import setup, find_packages

setup(
    name="mcsolol",
    version="0.1.0",
    packages=find_packages(),
    install_requires=[
        "flask==3.0.2",
        "flask-cors==4.0.0",
        "psutil==5.9.8",
        "requests==2.31.0",
        "python-dotenv==1.0.1",
        "websockets==12.0",
        "mcrcon==0.7.0",
        "python-json-logger==2.0.7"
    ],
) 